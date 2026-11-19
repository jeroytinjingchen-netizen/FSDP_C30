// Dashboard.jsx - the admin landing page (AS-2).
// Shows summary cards (students, active centres, upcoming gradings, collected this month) and short lists
// of upcoming gradings and recent payments. The centre switcher filters every figure.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useCentre } from '../CentreContext.jsx';
import CentreSwitcher from '../components/CentreSwitcher.jsx';
import { AwardIcon, BuildingIcon, CreditCardIcon, UsersIcon } from '../components/Icons.jsx';
import { formatDate, formatDateTime, formatMoney } from '../format.js';
import { PageHeader, Toast } from '../components/ui.jsx';

const CARDS = [
  { key: 'total_students',       label: 'Total students',       icon: UsersIcon,    skeleton: 'h-7 w-12' },
  { key: 'active_centres',       label: 'Active centres',       icon: BuildingIcon, skeleton: 'h-7 w-12' },
  { key: 'upcoming_gradings',    label: 'Upcoming gradings',    icon: AwardIcon,    skeleton: 'h-7 w-12' },
  { key: 'collected_this_month_cents', label: 'Collected this month', icon: CreditCardIcon, money: true, skeleton: 'h-7 w-20' },
];

// One summary card: icon, label, and big number.
function Card({ label, value, icon: Icon, skeleton }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm flex items-start gap-4">
      <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-text">
        <Icon size={20} />
      </span>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">
          {value ?? <span className={`inline-block animate-pulse rounded bg-muted ${skeleton}`} />}
        </p>
      </div>
    </div>
  );
}

// A titled box with a "view all" link, used for the two short lists.
function ListBox({ title, to, children }) {
  return (
    <section className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <Link to={to} className="text-xs font-medium text-accent-text hover:underline">
          View all →
        </Link>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export default function Dashboard() {
  const { centreId, centreQuery } = useCentre();
  const [data, setData] = useState(null); // null until loaded
  const [error, setError] = useState(null);
  const [alert, setAlert] = useState(null);

  // Fetch again whenever the selected centre changes. "cancelled" stops an old response from
  // overwriting a newer one (the cleanup function runs before the next effect).
  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    api(`/api/dashboard${centreQuery()}`)
      .then((d) => !cancelled && setData(d))
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setAlert({ error: true, text: err.message });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [centreId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loading = !data && !error;
  const t = data && data.totals;

  return (
    <>
      <PageHeader title="Dashboard" description="The state of the organisation at a glance.">
        <div className="w-56">
          <CentreSwitcher />
        </div>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CARDS.map(({ key, label, icon, money, skeleton }) => (
          <Card
            key={key}
            label={label}
            icon={icon}
            skeleton={skeleton}
            value={
              t
                ? money
                  ? formatMoney(t[key])
                  : t[key]
                : null
            }
          />
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <ListBox title="Upcoming gradings" to="/admin/grading">
          {loading && (
            <ul className="divide-y divide-border text-sm">
              {[0, 1, 2].map((i) => (
                <li key={i} className="flex items-center justify-between py-2">
                  <span className="inline-block h-4 w-32 animate-pulse rounded bg-muted" />
                  <span className="inline-block h-4 w-20 animate-pulse rounded bg-muted" />
                </li>
              ))}
            </ul>
          )}
          {error && <p className="text-sm text-destructive">Failed to load. {error}</p>}
          {data && data.upcomingGradings.length === 0 && (
            <p className="text-sm text-muted-foreground">No upcoming gradings.</p>
          )}
          <ul className="divide-y divide-border text-sm">
            {data &&
              data.upcomingGradings.map((g) => (
                <li key={g.id} className="flex items-center justify-between py-2.5">
                  <span className="font-medium">{g.title || 'Grading'}</span>
                  <span className="text-right text-muted-foreground text-xs">
                    <span className="block">{formatDate(g.starts_at)}</span>
                    <span className="block">{g.student_count} students</span>
                  </span>
                </li>
              ))}
          </ul>
        </ListBox>

        <ListBox title="Recent payments" to="/admin/payments">
          {loading && (
            <ul className="divide-y divide-border text-sm">
              {[0, 1, 2].map((i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-2">
                  <span className="inline-block h-4 w-28 animate-pulse rounded bg-muted" />
                  <span className="inline-block h-4 w-16 animate-pulse rounded bg-muted" />
                </li>
              ))}
            </ul>
          )}
          {error && <p className="text-sm text-destructive">Failed to load. {error}</p>}
          {data && data.recentPayments.length === 0 && (
            <p className="text-sm text-muted-foreground">No payments yet.</p>
          )}
          <ul className="divide-y divide-border text-sm">
            {data &&
              data.recentPayments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span>
                    <span className="font-medium">
                      {p.first_name} {p.last_name}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {p.package_name || 'Package'} · {formatDateTime(p.paid_at)}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-medium tabular-nums">{formatMoney(p.amount_cents)}</span>
                    <span className={`block text-xs ${p.status === 'COMPLETED' ? 'text-success-text' : 'text-destructive'}`}>
                      {p.status === 'COMPLETED' ? 'Successful' : 'Failed'}
                    </span>
                  </span>
                </li>
              ))}
          </ul>
        </ListBox>
      </div>

      <Toast alert={alert} onDismiss={() => setAlert(null)} />
    </>
  );
}
