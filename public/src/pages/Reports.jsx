import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useCentre } from '../CentreContext.jsx';
import { CheckCircleIcon } from '../components/Icons.jsx';
import { EmptyState, Field, PageHeader, SkeletonRows, inputClass } from '../components/ui.jsx';

const money = (cents) =>
  new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD' }).format(Number(cents || 0) / 100);

const displayDate = (iso) =>
  new Intl.DateTimeFormat('en-SG', {
    timeZone: 'Asia/Singapore',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));

const monthStart = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString('en-CA');
};
const today = () => new Date().toLocaleDateString('en-CA');

export default function Reports() {
  const { centreId, centreQuery } = useCentre();
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!from || !to) return;
    if (from > to) {
      setReport(null);
      setError('The to date must be on or after the from date.');
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError('');
    const q = centreQuery('&');
    api(`/api/reports/financial?from=${from}&to=${to}${q}`)
      .then((res) => {
        if (active) setReport(res);
      })
      .catch((err) => {
        if (active) {
          setReport(null);
          setError(err.message || 'Failed to load report.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // centreQuery changes identity each render, so centreId is the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, centreId]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Financial reports"
        description="Fees collected, outstanding balances and transactions for a chosen date range."
      />

      <div className="grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2">
        <Field label="From">
          <input type="date" className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="To">
          <input type="date" className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>

      {from && to && from <= to && (
        <div>
          <a
            href={`/api/reports/financial.csv?from=${from}&to=${to}${centreQuery('&')}`}
            download
            className="inline-flex items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent-soft"
          >
            Export CSV
          </a>
        </div>
      )}

      {loading && <SkeletonRows rows={4} cols={4} />}
      {!loading && error && <p className="text-sm text-destructive">{error}</p>}

      {!loading && !error && report && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">Collected</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{money(report.totals.collected_cents)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">Invoiced in range</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{money(report.totals.invoiced_cents)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">Outstanding (all unpaid balances)</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{money(report.totals.outstanding_cents)}</p>
            </div>
          </div>

          <section className="overflow-hidden rounded-xl border border-border bg-card">
            <h2 className="px-5 pt-5 text-base font-semibold text-foreground">Transactions</h2>
            {report.transactions.length === 0 ? (
              <div className="p-5">
                <EmptyState icon={CheckCircleIcon} title="No transactions" hint="No payments were recorded in this range." />
              </div>
            ) : (
              <div className="overflow-x-auto p-5">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Transactions</caption>
                  <thead className="text-muted-foreground">
                    <tr>
                      <th scope="col" className="py-2 font-medium">Paid</th>
                      <th scope="col" className="py-2 font-medium">Invoice</th>
                      <th scope="col" className="py-2 font-medium">Student</th>
                      <th scope="col" className="py-2 font-medium">Centre</th>
                      <th scope="col" className="py-2 font-medium">Channel</th>
                      <th scope="col" className="py-2 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {report.transactions.map((t) => (
                      <tr key={t.id}>
                        <td className="py-2 whitespace-nowrap">{displayDate(t.paid_at)}</td>
                        <td className="py-2">{t.invoice_number}</td>
                        <td className="py-2">
                          {t.first_name} {t.last_name}
                        </td>
                        <td className="py-2">{t.centre_name}</td>
                        <td className="py-2">{t.channel.replace('_', ' ')}</td>
                        <td className="py-2 text-right">{money(t.amount_cents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
