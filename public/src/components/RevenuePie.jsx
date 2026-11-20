// RevenuePie.jsx - donut chart of where the revenue comes from (dashboard).
//
// Props:
//   byPackage: [{ id, label, month_cents, all_cents }]  - always present once loaded
//   byCentre:  same shape, or null when the page is filtered to one centre
//   loading / error: from the dashboard fetch
//
// How it is drawn: each slice is an SVG <circle> with a thick stroke. stroke-dasharray draws only
// a slice-length piece of the ring and stroke-dashoffset moves it round to where the slice starts,
// so a single 100% slice still works (an arc path cannot draw a full circle).
//
// Colours follow the entity, not the period: slots are handed out by all-time order, so switching
// "This month" / "All time" never repaints a package. Past 6 parts, the smallest fold into "Other".
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from './ui.jsx';
import { formatMoney } from '../format.js';

const MAX_SLICES = 6;
const PERIODS = [
  { key: 'month', label: 'This month', field: 'month_cents' },
  { key: 'all', label: 'All time', field: 'all_cents' },
];
const GROUPS = [
  { key: 'package', label: 'By package' },
  { key: 'centre', label: 'By centre' },
];

// Ring geometry, in SVG units (viewBox is SIZE x SIZE).
const SIZE = 200;
const RADIUS = 72;
const THICKNESS = 28;
const CIRC = 2 * Math.PI * RADIUS;
const GAP = 2; // surface-coloured gap between slices

const percent = (part, whole) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

// Small pill toggle group (same look as the rank tier filter).
function Toggle({ label, options, value, onChange }) {
  return (
    <div role="group" aria-label={label} className="flex gap-1">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={value === o.key}
          onClick={() => onChange(o.key)}
          className={cn(
            'rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-150',
            value === o.key
              ? 'border-transparent bg-accent-soft text-accent-text'
              : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Give each row a fixed colour slot by all-time rank, folding the tail into "Other".
function assignSlots(rows) {
  const sorted = [...rows].sort((a, b) => b.all_cents - a.all_cents);
  const keep = sorted.length > MAX_SLICES ? MAX_SLICES - 1 : MAX_SLICES;
  const named = sorted.slice(0, keep).map((r, i) => ({ ...r, color: `var(--series-${i + 1})` }));
  const rest = sorted.slice(keep);
  if (rest.length === 0) return named;
  return [
    ...named,
    {
      id: '__other',
      label: `Other (${rest.length})`,
      month_cents: rest.reduce((n, r) => n + r.month_cents, 0),
      all_cents: rest.reduce((n, r) => n + r.all_cents, 0),
      color: 'var(--series-other)',
    },
  ];
}

export default function RevenuePie({ byPackage, byCentre, loading, error }) {
  const [period, setPeriod] = useState('month');
  const [groupBy, setGroupBy] = useState('package');
  const [hovered, setHovered] = useState(null); // id of the hovered slice

  const effectiveGroup = groupBy === 'centre' && byCentre ? 'centre' : 'package';
  const field = PERIODS.find((p) => p.key === period).field;
  const periodLabel = PERIODS.find((p) => p.key === period).label;

  const slots = useMemo(
    () => assignSlots((effectiveGroup === 'centre' ? byCentre : byPackage) || []),
    [effectiveGroup, byCentre, byPackage]
  );

  // Slices for the chosen period: drop zero rows, largest first (colours already fixed).
  const slices = useMemo(() => {
    const live = slots.filter((s) => s[field] > 0).sort((a, b) => b[field] - a[field]);
    const total = live.reduce((n, s) => n + s[field], 0);
    let start = 0;
    return {
      total,
      items: live.map((s) => {
        const len = (s[field] / total) * CIRC;
        const item = { ...s, value: s[field], pct: percent(s[field], total), start, len };
        start += len;
        return item;
      }),
    };
  }, [slots, field]);

  const active = slices.items.find((s) => s.id === hovered) || null;
  const multi = slices.items.length > 1;

  return (
    <section className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">Revenue breakdown</h2>
        <div className="flex flex-wrap items-center gap-3">
          {byCentre && <Toggle label="Group revenue" options={GROUPS} value={effectiveGroup} onChange={setGroupBy} />}
          <Toggle label="Revenue period" options={PERIODS} value={period} onChange={setPeriod} />
          <Link to="/admin/payments" className="text-xs font-medium text-accent-text hover:underline">
            View all →
          </Link>
        </div>
      </div>

      <div className="p-5">
        {error && <p className="text-sm text-destructive">Failed to load. {error}</p>}

        {!error && (
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
            {/* The donut */}
            <div className="relative size-48 shrink-0">
              <svg
                viewBox={`0 0 ${SIZE} ${SIZE}`}
                className="size-full -rotate-90"
                role="img"
                aria-label={
                  loading
                    ? 'Loading revenue'
                    : `Revenue ${periodLabel.toLowerCase()}: ${slices.items
                        .map((s) => `${s.label} ${s.pct}%`)
                        .join(', ') || 'none'}`
                }
              >
                {/* Track: visible while loading or when there is nothing to show */}
                <circle
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke="var(--muted)"
                  strokeWidth={THICKNESS}
                  className={loading ? 'animate-pulse' : undefined}
                />
                {!loading &&
                  slices.items.map((s) => (
                    <circle
                      key={s.id}
                      cx={SIZE / 2}
                      cy={SIZE / 2}
                      r={RADIUS}
                      fill="none"
                      stroke={s.color}
                      strokeWidth={hovered === s.id ? THICKNESS + 6 : THICKNESS}
                      strokeDasharray={`${Math.max(s.len - (multi ? GAP : 0), 0.5)} ${CIRC}`}
                      strokeDashoffset={-s.start}
                      opacity={hovered && hovered !== s.id ? 0.35 : 1}
                      style={{ transition: 'opacity 150ms, stroke-width 150ms', cursor: 'pointer' }}
                      pointerEvents="stroke"
                      onMouseEnter={() => setHovered(s.id)}
                      onMouseLeave={() => setHovered(null)}
                    />
                  ))}
              </svg>

              {/* Centre label: the total, or the hovered slice */}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-10">
                {loading ? (
                  <span className="inline-block h-6 w-20 animate-pulse rounded bg-muted" />
                ) : active ? (
                  <>
                    <span className="max-w-full truncate text-xs text-muted-foreground">{active.label}</span>
                    <span className="text-lg font-semibold tabular-nums">{formatMoney(active.value)}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{active.pct}%</span>
                  </>
                ) : (
                  <>
                    <span className="text-xs text-muted-foreground">{periodLabel}</span>
                    <span className="text-lg font-semibold tabular-nums">{formatMoney(slices.total)}</span>
                  </>
                )}
              </div>
            </div>

            {/* Legend + figures (also the accessible table view of the chart) */}
            <div className="w-full min-w-0 flex-1">
              {loading && (
                <ul className="divide-y divide-border text-sm">
                  {[0, 1, 2].map((i) => (
                    <li key={i} className="flex items-center justify-between py-2">
                      <span className="inline-block h-4 w-32 animate-pulse rounded bg-muted" />
                      <span className="inline-block h-4 w-16 animate-pulse rounded bg-muted" />
                    </li>
                  ))}
                </ul>
              )}
              {!loading && slices.items.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {period === 'month' ? 'No revenue collected this month yet.' : 'No revenue collected yet.'}
                </p>
              )}
              {!loading && slices.items.length > 0 && (
                <ul className="divide-y divide-border text-sm">
                  {slices.items.map((s) => (
                    <li
                      key={s.id}
                      onMouseEnter={() => setHovered(s.id)}
                      onMouseLeave={() => setHovered(null)}
                      className={cn(
                        '-mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors',
                        hovered === s.id && 'bg-muted'
                      )}
                    >
                      <span className="size-3 shrink-0 rounded-sm" style={{ background: s.color }} aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate font-medium">{s.label}</span>
                      <span className="tabular-nums">{formatMoney(s.value)}</span>
                      <span className="w-14 text-right text-xs text-muted-foreground tabular-nums">{s.pct}%</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
