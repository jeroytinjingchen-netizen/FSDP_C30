import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { CheckCircleIcon, PlusIcon } from '../components/Icons.jsx';
import {
  Button,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  SkeletonRows,
  Toast,
  inputClass,
} from '../components/ui.jsx';

const CHANNELS = ['CASH', 'BANK_TRANSFER', 'WHATSAPP', 'EMAIL', 'OTHER'];
const EMPTY_FEE = { centre_id: '', name: '', description: '', amount: '', due_date: '' };
const EMPTY_PAYMENT = { invoiceId: '', amount: '', channel: 'CASH', reference: '', notes: '' };

const money = (cents) =>
  new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD' }).format(Number(cents || 0) / 100);

const displayDate = (iso) =>
  new Intl.DateTimeFormat('en-SG', { timeZone: 'Asia/Singapore', day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(iso)
  );

const STATUS_STYLE = {
  UNPAID: 'bg-muted text-muted-foreground',
  PARTIALLY_PAID: 'bg-accent-soft text-accent-text',
  PAID: 'bg-foreground text-background',
  VOID: 'bg-muted text-muted-foreground line-through',
};

export default function Payments() {
  const [summary, setSummary] = useState(null);
  const [fees, setFees] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [centres, setCentres] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [feeForm, setFeeForm] = useState(null);
  const [payForm, setPayForm] = useState(null);
  const [alert, setAlert] = useState(null);

  const load = useCallback(async () => {
    const q = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : '';
    const [sum, feeList, invList, centreList] = await Promise.all([
      api('/api/billing/summary'),
      api('/api/billing/fees'),
      api(`/api/billing/invoices${q}`),
      api('/api/centres'),
    ]);
    setSummary(sum);
    setFees(feeList);
    setInvoices(invList);
    setCentres(centreList.filter((c) => c.is_active));
  }, [statusFilter]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => setAlert({ error: true, text: err.message }))
      .finally(() => setLoading(false));
  }, [load]);

  async function run(action, successText) {
    try {
      const result = await action();
      setAlert({ error: false, text: successText(result) });
      await load();
    } catch (err) {
      setAlert({ error: true, text: err.message });
    }
  }

  function saveFee(e) {
    e.preventDefault();
    const f = feeForm;
    setFeeForm(null);
    run(
      () =>
        api('/api/billing/fees', {
          method: 'POST',
          body: JSON.stringify({
            centre_id: f.centre_id || null,
            name: f.name,
            description: f.description || null,
            amount_cents: Math.round(Number(f.amount) * 100),
            currency: 'SGD',
            due_date: f.due_date,
          }),
        }),
      () => 'Fee item created.'
    );
  }

  function generate(fee) {
    run(
      () => api(`/api/billing/fees/${fee.id}/generate`, { method: 'POST' }),
      (r) => `Created ${r.created} invoice${r.created === 1 ? '' : 's'}.`
    );
  }

  function savePayment(e) {
    e.preventDefault();
    const p = payForm;
    setPayForm(null);
    run(
      () =>
        api(`/api/billing/invoices/${p.invoiceId}/payments`, {
          method: 'POST',
          body: JSON.stringify({
            amount_cents: Math.round(Number(p.amount) * 100),
            channel: p.channel,
            reference: p.reference || null,
            notes: p.notes || null,
          }),
        }),
      (r) => (r.invoice_status === 'PAID' ? 'Invoice paid in full.' : `Payment recorded. ${money(r.outstanding_cents)} outstanding.`)
    );
  }

  const cards = [
    { label: 'Collected', value: money(summary?.collected_cents) },
    { label: 'Outstanding', value: money(summary?.outstanding_cents) },
    { label: 'Overdue', value: `${money(summary?.overdue_cents)} (${summary?.overdue_count ?? 0})` },
  ];

  return (
    <>
      <PageHeader title="Payments" description="Fee items, invoices and manual payments across all centres.">
        <Button variant="secondary" onClick={() => setFeeForm({ ...EMPTY_FEE, centre_id: '' })} disabled={loading}>
          <PlusIcon size={18} />
          New fee
        </Button>
        <Button onClick={() => setPayForm({ ...EMPTY_PAYMENT, invoiceId: invoices.find((i) => i.status !== 'PAID')?.id || '' })} disabled={invoices.length === 0}>
          <CheckCircleIcon size={18} />
          Record payment
        </Button>
      </PageHeader>

      <section aria-label="Payment summary" className="mb-6 grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border bg-card p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{c.label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{c.value}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="fees-heading" className="mb-8">
        <h2 id="fees-heading" className="mb-3 text-base font-semibold">Fee items</h2>
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Fee items</caption>
              <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Name</th>
                  <th scope="col" className="px-4 py-3 font-medium">Centre</th>
                  <th scope="col" className="px-4 py-3 font-medium">Amount</th>
                  <th scope="col" className="px-4 py-3 font-medium">Due</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && <SkeletonRows rows={3} cols={5} />}
                {!loading && fees.length === 0 && (
                  <tr>
                    <td colSpan={5}>
                      <EmptyState icon={CheckCircleIcon} title="No fee items yet" hint="Create a fee, then generate invoices for the students it applies to." />
                    </td>
                  </tr>
                )}
                {!loading &&
                  fees.map((f) => (
                    <tr key={f.id} className="border-t transition-colors duration-200 hover:bg-muted/60">
                      <td className="px-4 py-3 font-medium">{f.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{f.centre_name || 'All centres'}</td>
                      <td className="px-4 py-3 tabular-nums">{money(f.amount_cents)}</td>
                      <td className="px-4 py-3 tabular-nums">{displayDate(f.due_date)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <Button variant="secondary" onClick={() => generate(f)} aria-label={`Generate invoices for ${f.name}`}>
                            Generate invoices
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section aria-labelledby="invoices-heading">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="invoices-heading" className="text-base font-semibold">Invoices</h2>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Status</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputClass}>
              <option value="">All</option>
              <option value="UNPAID">Unpaid</option>
              <option value="PARTIALLY_PAID">Partially paid</option>
              <option value="PAID">Paid</option>
              <option value="VOID">Void</option>
            </select>
          </label>
        </div>
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Invoices</caption>
              <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Invoice</th>
                  <th scope="col" className="px-4 py-3 font-medium">Student</th>
                  <th scope="col" className="px-4 py-3 font-medium">Total</th>
                  <th scope="col" className="px-4 py-3 font-medium">Outstanding</th>
                  <th scope="col" className="px-4 py-3 font-medium">Due</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading && <SkeletonRows rows={4} cols={6} />}
                {!loading && invoices.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState icon={CheckCircleIcon} title="No invoices" hint="Generate invoices from a fee item to see them here." />
                    </td>
                  </tr>
                )}
                {!loading &&
                  invoices.map((i) => (
                    <tr key={i.id} className="border-t transition-colors duration-200 hover:bg-muted/60">
                      <td className="px-4 py-3 font-medium">
                        {i.invoice_number}
                        <span className="block text-xs text-muted-foreground">{i.description}</span>
                      </td>
                      <td className="px-4 py-3">{`${i.first_name} ${i.last_name}`}</td>
                      <td className="px-4 py-3 tabular-nums">{money(i.amount_cents)}</td>
                      <td className="px-4 py-3 tabular-nums">{money(i.outstanding_cents)}</td>
                      <td className="px-4 py-3 tabular-nums">
                        {displayDate(i.due_date)}
                        {i.is_overdue && <span className="ml-2 text-xs font-medium text-accent">Overdue</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[i.status] || ''}`}>
                          {i.status.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {feeForm && (
        <Modal labelledBy="fee-form-title" onClose={() => setFeeForm(null)}>
          <form onSubmit={saveFee} className="space-y-4">
            <h2 id="fee-form-title" className="text-lg font-semibold">New fee item</h2>
            <Field label="Centre">
              <select value={feeForm.centre_id} onChange={(e) => setFeeForm({ ...feeForm, centre_id: e.target.value })} className={inputClass} data-autofocus>
                <option value="">All centres</option>
                {centres.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Name">
              <input required maxLength={150} value={feeForm.name} onChange={(e) => setFeeForm({ ...feeForm, name: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Description">
              <input maxLength={500} value={feeForm.description} onChange={(e) => setFeeForm({ ...feeForm, description: e.target.value })} className={inputClass} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Amount (SGD)">
                <input type="number" min="0" step="0.01" required value={feeForm.amount} onChange={(e) => setFeeForm({ ...feeForm, amount: e.target.value })} className={inputClass} />
              </Field>
              <Field label="Due date">
                <input type="date" required value={feeForm.due_date} onChange={(e) => setFeeForm({ ...feeForm, due_date: e.target.value })} className={inputClass} />
              </Field>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setFeeForm(null)}>Cancel</Button>
              <Button type="submit">Save</Button>
            </div>
          </form>
        </Modal>
      )}

      {payForm && (
        <Modal labelledBy="pay-form-title" onClose={() => setPayForm(null)}>
          <form onSubmit={savePayment} className="space-y-4">
            <h2 id="pay-form-title" className="text-lg font-semibold">Record payment</h2>
            <Field label="Invoice">
              <select required value={payForm.invoiceId} onChange={(e) => setPayForm({ ...payForm, invoiceId: e.target.value })} className={inputClass} data-autofocus>
                <option value="" disabled>Select an invoice</option>
                {invoices.filter((i) => i.status !== 'PAID' && i.status !== 'VOID').map((i) => (
                  <option key={i.id} value={i.id}>
                    {`${i.invoice_number} - ${i.first_name} ${i.last_name} (${money(i.outstanding_cents)} due)`}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Amount (SGD)">
                <input type="number" min="0.01" step="0.01" required value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} className={inputClass} />
              </Field>
              <Field label="Channel">
                <select value={payForm.channel} onChange={(e) => setPayForm({ ...payForm, channel: e.target.value })} className={inputClass}>
                  {CHANNELS.map((c) => (
                    <option key={c} value={c}>{c.replace('_', ' ')}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Reference">
              <input maxLength={150} value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} className={inputClass} />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setPayForm(null)}>Cancel</Button>
              <Button type="submit">Save</Button>
            </div>
          </form>
        </Modal>
      )}

      <Toast alert={alert} onDismiss={() => setAlert(null)} />
    </>
  );
}
