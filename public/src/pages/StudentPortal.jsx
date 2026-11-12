import { useCallback, useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { CheckCircleIcon, LogOutIcon } from '../components/Icons.jsx';
import { Button, EmptyState, PageHeader, Toast } from '../components/ui.jsx';

const money = (cents, currency = 'SGD') =>
  new Intl.NumberFormat('en-SG', { style: 'currency', currency }).format(Number(cents || 0) / 100);

const displayDateTime = (iso) =>
  new Intl.DateTimeFormat('en-SG', {
    timeZone: 'Asia/Singapore',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));

const displayDate = (iso) =>
  new Intl.DateTimeFormat('en-SG', { timeZone: 'Asia/Singapore', day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(iso)
  );

export default function StudentPortal() {
  const { user, logout } = useAuth();
  const [searchParams] = useSearchParams();
  const [invoices, setInvoices] = useState([]);
  const [belt, setBelt] = useState(null);
  const [timetable, setTimetable] = useState([]);
  const [days, setDays] = useState(14);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [alert, setAlert] = useState(null);
  const [selected, setSelected] = useState(null);
  const [payments, setPayments] = useState([]);
  const [contact, setContact] = useState({ phone: '', guardian_name: '', guardian_phone: '' });
  const [savingContact, setSavingContact] = useState(false);

  const loadTimetable = useCallback(
    (windowDays) =>
      api(`/api/student/timetable?days=${windowDays}`)
        .then(setTimetable)
        .catch((err) => setAlert({ error: true, text: err.message })),
    []
  );

  const load = useCallback(() => {
    setLoading(true);
    return Promise.all([
      api('/api/student/invoices').then(setInvoices),
      api('/api/student/belt').then(setBelt),
      api('/api/student/me').then((data) => {
        const s = data.student || {};
        setContact({ phone: s.phone || '', guardian_name: s.guardian_name || '', guardian_phone: s.guardian_phone || '' });
      }),
    ])
      .catch((err) => setAlert({ error: true, text: err.message }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadTimetable(days);
  }, [days, loadTimetable]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (searchParams.get('paid')) {
      setAlert({ error: false, text: 'Payment received. Your balance will update once Stripe confirms it.' });
      load();
    }
  }, [searchParams, load]);

  if (!user || user.role !== 'STUDENT') return <Navigate to="/" replace />;

  async function pay(invoice) {
    setBusyId(invoice.id);
    try {
      const data = await api(`/api/student/invoices/${invoice.id}/checkout`, { method: 'POST' });
      window.location.assign(data.url);
    } catch (err) {
      setAlert({ error: true, text: err.message });
      setBusyId(null);
    }
  }

  async function openInvoice(invoice) {
    setSelected(invoice);
    setPayments([]);
    try {
      const data = await api(`/api/student/invoices/${invoice.id}/payments`);
      setPayments(data.payments);
    } catch (err) {
      setAlert({ error: true, text: err.message });
    }
  }

  async function saveContact(event) {
    event.preventDefault();
    setSavingContact(true);
    try {
      await api('/api/student/profile', { method: 'PATCH', body: JSON.stringify(contact) });
      setAlert({ error: false, text: 'Contact details saved.' });
    } catch (err) {
      setAlert({ error: true, text: err.message });
    } finally {
      setSavingContact(false);
    }
  }

  const name = user.studentDetails ? `${user.studentDetails.first_name} ${user.studentDetails.last_name}` : user.email;

  return (
    <div className="min-h-screen bg-background">
      <header className="flex h-14 items-center justify-between border-b bg-sidebar px-4 text-white print:hidden">
        <span className="text-sm font-medium">Aikido Shinjukai · Student portal</span>
        <button
          type="button"
          onClick={logout}
          className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium hover:bg-sidebar-active"
        >
          <LogOutIcon size={18} />
          Log out
        </button>
      </header>

      <main className="mx-auto max-w-4xl p-4 sm:p-6">
        <PageHeader title={`Hi, ${name}`} description="Your belt, classes and invoices." />

        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <section className="rounded-xl border bg-card p-4">
            <h2 className="text-sm font-medium text-muted-foreground">Current belt</h2>
            <p className="mt-2 text-2xl font-semibold">{belt ? belt.name : '—'}</p>
            {belt?.rank_since && (
              <p className="mt-1 text-xs text-muted-foreground">Since {displayDate(belt.rank_since)}</p>
            )}
          </section>

          <section className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium text-muted-foreground">Upcoming classes</h2>
              <select
                aria-label="Timetable window"
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="rounded-md border bg-background px-2 py-1 text-xs"
              >
                <option value={14}>Next 14 days</option>
                <option value={30}>Next 30 days</option>
                <option value={90}>Next 90 days</option>
              </select>
            </div>
            {timetable.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No classes scheduled.</p>
            ) : (
              <ul className="mt-2 divide-y text-sm">
                {timetable.map((s) => (
                  <li key={s.id} className="flex justify-between gap-2 py-2">
                    <span className="font-medium">{s.class_name}</span>
                    <span className="text-right text-muted-foreground">
                      {displayDateTime(s.starts_at)} · {s.venue_name}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading invoices…</p>
        ) : invoices.length === 0 ? (
          <EmptyState icon={CheckCircleIcon} title="No invoices yet" hint="Invoices from your centre will appear here." />
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-left text-sm">
              <thead className="border-b text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Invoice</th>
                  <th scope="col" className="px-4 py-3 font-medium">Due</th>
                  <th scope="col" className="px-4 py-3 font-medium">Amount</th>
                  <th scope="col" className="px-4 py-3 font-medium">Outstanding</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium">{inv.invoice_number}</div>
                      <div className="text-xs text-muted-foreground">{inv.description}</div>
                    </td>
                    <td className="px-4 py-3">{displayDate(inv.due_date)}</td>
                    <td className="px-4 py-3 tabular-nums">{money(inv.amount_cents, inv.currency)}</td>
                    <td className="px-4 py-3 tabular-nums">{money(inv.outstanding_cents, inv.currency)}</td>
                    <td className="px-4 py-3">
                      {inv.is_overdue ? 'Overdue' : inv.status.replace('_', ' ')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="secondary" onClick={() => openInvoice(inv)}>
                          View
                        </Button>
                        {Number(inv.outstanding_cents) > 0 && (
                          <Button onClick={() => pay(inv)} disabled={busyId === inv.id}>
                            {busyId === inv.id ? 'Opening…' : 'Pay online'}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {selected && (
          <section className="mt-6 rounded-xl border bg-card p-4" aria-label="Invoice details">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-semibold">{selected.invoice_number}</h2>
                <p className="text-sm text-muted-foreground">{selected.description}</p>
              </div>
              <div className="flex gap-2 print:hidden">
                <Button variant="secondary" onClick={() => window.print()}>
                  Print receipt
                </Button>
                <Button variant="secondary" onClick={() => setSelected(null)}>
                  Close
                </Button>
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-muted-foreground">Amount</dt>
                <dd className="tabular-nums">{money(selected.amount_cents, selected.currency)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Paid</dt>
                <dd className="tabular-nums">{money(selected.paid_cents, selected.currency)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Outstanding</dt>
                <dd className="tabular-nums">{money(selected.outstanding_cents, selected.currency)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Due</dt>
                <dd>{displayDate(selected.due_date)}</dd>
              </div>
            </dl>
            <h3 className="mt-4 text-sm font-medium text-muted-foreground">Payments</h3>
            {payments.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No payments recorded yet.</p>
            ) : (
              <ul className="mt-2 divide-y text-sm">
                {payments.map((p) => (
                  <li key={p.id} className="flex justify-between gap-2 py-2">
                    <span>
                      {displayDate(p.paid_at)} · {p.channel.replace('_', ' ')}
                      {p.reference ? ` · ref ${p.reference}` : ''}
                    </span>
                    <span className="tabular-nums">{money(p.amount_cents, selected.currency)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <section className="mt-6 rounded-xl border bg-card p-4 print:hidden" aria-label="Contact details">
          <h2 className="font-semibold">Contact details</h2>
          <form onSubmit={saveContact} className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Your phone</span>
              <input
                className="rounded-md border bg-background px-3 py-2"
                value={contact.phone}
                maxLength={30}
                onChange={(e) => setContact({ ...contact, phone: e.target.value })}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Guardian name</span>
              <input
                className="rounded-md border bg-background px-3 py-2"
                value={contact.guardian_name}
                maxLength={100}
                onChange={(e) => setContact({ ...contact, guardian_name: e.target.value })}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Guardian phone</span>
              <input
                className="rounded-md border bg-background px-3 py-2"
                value={contact.guardian_phone}
                maxLength={30}
                onChange={(e) => setContact({ ...contact, guardian_phone: e.target.value })}
              />
            </label>
            <div className="sm:col-span-3">
              <Button type="submit" disabled={savingContact}>
                {savingContact ? 'Saving…' : 'Save contact details'}
              </Button>
            </div>
          </form>
        </section>
      </main>

      <Toast alert={alert} onDismiss={() => setAlert(null)} />
    </div>
  );
}
