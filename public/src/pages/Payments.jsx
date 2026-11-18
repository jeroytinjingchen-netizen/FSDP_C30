// pages/Payments.jsx - read-only payments list for admins (AS-12) with CSV export (AS-13).
// Admins cannot create, edit or delete payments here. Students pay through Stripe checkout
// and the server records each payment.

// React hooks used below:
//   useState    keeps a value that, when changed, redraws the page.
//   useEffect   runs code after the page draws (here: loading data when a filter changes).
//   useCallback keeps the same function between redraws so useEffect does not re-run needlessly.
//   useMemo     remembers a computed value until its inputs change.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { useCentre } from '../CentreContext.jsx';
import CentreSwitcher from '../components/CentreSwitcher.jsx';
import { CheckCircleIcon } from '../components/Icons.jsx';
import { Button, EmptyState, PageHeader, SkeletonRows, Toast, inputClass } from '../components/ui.jsx';

// Formats cents as Singapore dollars, for example 18000 -> "$180.00".
// Intl.NumberFormat is the browser's built-in number formatter.
const money = (cents) =>
  new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD' }).format(Number(cents || 0) / 100);

// Formats a timestamp as Singapore date and time, for example "18 Nov 2026, 1:13 am".
// Payments keep the time, because admins match them against bank statements.
const displayDateTime = (iso) =>
  iso
    ? new Intl.DateTimeFormat('en-SG', {
        timeZone: 'Asia/Singapore',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(iso))
    : '-';

// Payment methods are stored as codes. This turns "BANK_TRANSFER" into "Bank transfer".
const methodLabel = (code) => {
  const text = String(code || '').toLowerCase().replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
};

// Status badge colours. Only two statuses exist: Successful and Failed.
const STATUS_STYLE = {
  SUCCESSFUL: 'bg-accent-soft text-accent-text',
  FAILED: 'bg-destructive-soft text-destructive',
};

// The filter form starts empty, which means "show everything".
const EMPTY_FILTERS = { search: '', status: '', paymentFrom: '', paymentTo: '' };

export default function Payments() {
  // centreId is the centre chosen in the switcher (null means all centres).
  const { centreId } = useCentre();
  const [payments, setPayments] = useState([]);
  const [totalCents, setTotalCents] = useState(0);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);

  // Builds the query string (?status=...&search=...) from the active filters.
  // Both the list request and the export link use it, so the CSV matches what is on screen.
  // useMemo recomputes it only when the filters or the centre change.
  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (centreId) params.set('centreId', centreId);
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    const text = params.toString();
    return text ? `?${text}` : '';
  }, [filters, centreId]);

  // Fetches the filtered list from the server.
  const load = useCallback(async () => {
    const data = await api(`/api/payments${queryString}`);
    setPayments(data.payments);
    setTotalCents(data.totalCollectedCents);
  }, [queryString]);

  // Reload whenever the filters or the centre change.
  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => setAlert({ error: true, text: err.message }))
      .finally(() => setLoading(false));
  }, [load]);

  // Returns an onChange handler that updates one filter field.
  // Example: onChange={setField('status')} sets filters.status to the chosen value.
  const setField = (name) => (e) => setFilters((current) => ({ ...current, [name]: e.target.value }));

  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <>
      <PageHeader title="Payments" description="Payment records for cross-checking against bank statements. Read-only.">
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <div className="w-full sm:w-56">
            <CentreSwitcher />
          </div>
          {/* A plain link downloads the file. The browser sends the session cookie with it.
              The same query string is used, so the export respects the active filters. */}
          <a
            href={`/api/payments/export.csv${queryString}`}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-input bg-card px-4 text-sm font-semibold text-foreground transition-colors duration-200 hover:bg-muted"
          >
            Export CSV
          </a>
        </div>
      </PageHeader>

      <section aria-label="Payment summary" className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total collected (shown)</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{money(totalCents)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Successful payments only.</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Payments shown</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{payments.length}</p>
        </div>
      </section>

      <section aria-label="Filters" className="mb-4 grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Reference number</span>
          <input type="search" value={filters.search} onChange={setField('search')} placeholder="Search reference" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Status</span>
          <select value={filters.status} onChange={setField('status')} className={inputClass}>
            <option value="">All</option>
            <option value="SUCCESSFUL">Successful</option>
            <option value="FAILED">Failed</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Payment date from</span>
          <input type="date" value={filters.paymentFrom} onChange={setField('paymentFrom')} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Payment date to</span>
          <input type="date" value={filters.paymentTo} onChange={setField('paymentTo')} className={inputClass} />
        </label>
        <div className="flex items-end">
          <Button variant="secondary" onClick={() => setFilters(EMPTY_FILTERS)} disabled={!hasFilters}>
            Clear filters
          </Button>
        </div>
      </section>

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Payments</caption>
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Student</th>
                <th scope="col" className="px-4 py-3 font-medium">Centre</th>
                <th scope="col" className="px-4 py-3 font-medium">Package</th>
                <th scope="col" className="px-4 py-3 font-medium">Amount</th>
                <th scope="col" className="px-4 py-3 font-medium">Payment date</th>
                <th scope="col" className="px-4 py-3 font-medium">Method</th>
                <th scope="col" className="px-4 py-3 font-medium">Reference</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && <SkeletonRows rows={5} cols={8} />}
              {!loading && payments.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    <EmptyState
                      icon={CheckCircleIcon}
                      title="No payments found"
                      hint={hasFilters ? 'Try clearing a filter.' : 'Payments appear here when students buy packages.'}
                    />
                  </td>
                </tr>
              )}
              {!loading &&
                payments.map((p) => (
                  <tr key={p.id} className="border-t transition-colors duration-200 hover:bg-muted/60">
                    <td className="px-4 py-3 font-medium">{`${p.first_name} ${p.last_name}`}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.centre_name}</td>
                    <td className="px-4 py-3">{p.package_name || '-'}</td>
                    <td className="px-4 py-3 tabular-nums">{money(p.amount_cents)}</td>
                    <td className="px-4 py-3 tabular-nums">{displayDateTime(p.paid_at)}</td>
                    <td className="px-4 py-3">{methodLabel(p.payment_method)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{p.reference || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[p.status] || ''}`}>
                        {p.status === 'SUCCESSFUL' ? 'Successful' : 'Failed'}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <Toast alert={alert} onDismiss={() => setAlert(null)} />
    </>
  );
}
