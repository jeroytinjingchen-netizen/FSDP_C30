import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useCentre } from '../CentreContext.jsx';
import { CalendarIcon, CheckCircleIcon } from '../components/Icons.jsx';
import { EmptyState, PageHeader, SkeletonRows } from '../components/ui.jsx';

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

const monthLabel = (ym) =>
  new Intl.DateTimeFormat('en-SG', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${ym}-01T00:00:00Z`)
  );

// Grouped bars: collected (accent) and invoiced (muted) per month, drawn as plain SVG.
function MonthlyChart({ series }) {
  const width = 640;
  const height = 220;
  const pad = { top: 16, right: 16, bottom: 36, left: 56 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const max = Math.max(1, ...series.flatMap((m) => [m.collected_cents, m.invoiced_cents]));
  const groupW = innerW / series.length;
  const barW = Math.min(28, groupW / 3);
  const y = (cents) => pad.top + innerH - (cents / max) * innerH;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="Collected and invoiced by month">
      {[0, 0.5, 1].map((t) => (
        <g key={t}>
          <line x1={pad.left} x2={width - pad.right} y1={y(max * t)} y2={y(max * t)} className="stroke-border" />
          <text x={pad.left - 8} y={y(max * t) + 4} textAnchor="end" className="fill-muted-foreground text-[10px]">
            {money(max * t)}
          </text>
        </g>
      ))}
      {series.map((m, i) => {
        const x0 = pad.left + i * groupW + groupW / 2;
        return (
          <g key={m.month}>
            <rect x={x0 - barW - 2} y={y(m.collected_cents)} width={barW} height={pad.top + innerH - y(m.collected_cents)} rx="3" className="fill-primary">
              <title>{`Collected: ${money(m.collected_cents)}`}</title>
            </rect>
            <rect x={x0 + 2} y={y(m.invoiced_cents)} width={barW} height={pad.top + innerH - y(m.invoiced_cents)} rx="3" className="fill-muted-foreground/40">
              <title>{`Invoiced: ${money(m.invoiced_cents)}`}</title>
            </rect>
            <text x={x0} y={height - 12} textAnchor="middle" className="fill-muted-foreground text-[11px]">
              {monthLabel(m.month)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Card({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function Dashboard() {
  const { centreId, centreQuery } = useCentre();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api(`/api/dashboard${centreQuery()}`)
      .then((res) => {
        if (active) setData(res);
      })
      .catch((err) => {
        if (active) setError(err.message || 'Failed to load dashboard.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // centreQuery changes identity each render, so centreId is the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centreId]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Key numbers for the selected centre: students, fees collected, outstanding balance and upcoming gradings."
      />

      {loading && <SkeletonRows rows={4} cols={4} />}
      {!loading && error && <p className="text-sm text-destructive">{error}</p>}

      {!loading && !error && data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card label="Active students" value={data.totals.students} />
            <Card label="Fees collected" value={money(data.totals.collected_cents)} />
            <Card label="Outstanding" value={money(data.totals.outstanding_cents)} />
            <Card label="Upcoming gradings" value={data.totals.upcoming_gradings} />
          </div>

          <section className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-foreground">Collected vs invoiced, last 6 months</h2>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-primary" /> Collected
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-muted-foreground/40" /> Invoiced
                </span>
              </div>
            </div>
            <MonthlyChart series={data.monthly} />
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="mb-4 text-base font-semibold text-foreground">Upcoming gradings</h2>
              {data.upcomingGradings.length === 0 ? (
                <EmptyState icon={CalendarIcon} title="No upcoming gradings" hint="Scheduled sessions will appear here." />
              ) : (
                <ul className="divide-y divide-border">
                  {data.upcomingGradings.map((g) => (
                    <li key={g.id} className="flex items-center justify-between gap-4 py-3">
                      <div>
                        <p className="font-medium text-foreground">{g.title || 'Grading session'}</p>
                        <p className="text-xs text-muted-foreground">
                          {g.centre_name}
                          {g.venue_name ? ` · ${g.venue_name}` : ''}
                        </p>
                      </div>
                      <span className="whitespace-nowrap text-sm text-muted-foreground">{displayDate(g.starts_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="mb-4 text-base font-semibold text-foreground">Recent payments</h2>
              {data.recentPayments.length === 0 ? (
                <EmptyState icon={CheckCircleIcon} title="No payments yet" hint="Recorded payments will appear here." />
              ) : (
                <ul className="divide-y divide-border">
                  {data.recentPayments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-4 py-3">
                      <div>
                        <p className="font-medium text-foreground">
                          {p.first_name} {p.last_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {p.invoice_number} · {p.channel.replace('_', ' ')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-foreground">{money(p.amount_cents)}</p>
                        <p className="text-xs text-muted-foreground">{displayDate(p.paid_at)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
