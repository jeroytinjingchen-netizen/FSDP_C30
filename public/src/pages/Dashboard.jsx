// Dashboard.jsx - the admin landing page (AS-2).
// Shows summary cards (students, active centres, upcoming gradings, collected this month) and short lists
// of upcoming gradings and recent payments. The centre switcher filters every figure.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useCentre } from '../CentreContext.jsx';
import CentreSwitcher from '../components/CentreSwitcher.jsx';
import { formatDate, formatDateTime, formatMoney } from '../format.js';
import { PageHeader, Toast } from '../components/ui.jsx';

// One summary card: a label and a big number.
function Card({ label, value }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

// A titled box with a "view all" link, used for the two short lists.
function ListBox({ title, to, children }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">{title}</h2>
        <Link to={to} className="text-sm text-accent-text hover:underline">
          View all
        </Link>
      </div>
      {children}
    </section>
  );
}

export default function Dashboard() {
  const { centreId, centreQuery } = useCentre();
  const [data, setData] = useState(null); // null until loaded
  const [alert, setAlert] = useState(null);

  // Fetch again whenever the selected centre changes. "cancelled" stops an old response from
  // overwriting a newer one (the cleanup function runs before the next effect).
  useEffect(() => {
    let cancelled = false;
    setData(null);
    api(`/api/dashboard${centreQuery()}`)
      .then((d) => !cancelled && setData(d))
      .catch((err) => !cancelled && setAlert({ error: true, text: err.message }));
    return () => {
      cancelled = true;
    };
  }, [centreId]); // eslint-disable-line react-hooks/exhaustive-deps

  const t = data && data.totals;

  return (
    <>
      <PageHeader title="Dashboard" description="The state of the organisation at a glance.">
        <div className="w-56">
          <CentreSwitcher />
        </div>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Total students" value={t ? t.total_students : '...'} />
        <Card label="Active centres" value={t ? t.active_centres : '...'} />
        <Card label="Upcoming gradings" value={t ? t.upcoming_gradings : '...'} />
        <Card label="Collected this month" value={t ? formatMoney(t.collected_this_month_cents) : '...'} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <ListBox title="Upcoming gradings" to="/admin/grading">
          {data && data.upcomingGradings.length === 0 && <p className="text-sm text-muted-foreground">No upcoming gradings.</p>}
          <ul className="divide-y text-sm">
            {data &&
              data.upcomingGradings.map((g) => (
                <li key={g.id} className="flex items-center justify-between py-2">
                  <span className="font-medium">{g.title || 'Grading'}</span>
                  <span className="text-muted-foreground">
                    {formatDate(g.starts_at)} | {g.student_count} students
                  </span>
                </li>
              ))}
          </ul>
        </ListBox>

        <ListBox title="Recent payments" to="/admin/payments">
          {data && data.recentPayments.length === 0 && <p className="text-sm text-muted-foreground">No payments yet.</p>}
          <ul className="divide-y text-sm">
            {data &&
              data.recentPayments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                  <span>
                    <span className="font-medium">
                      {p.first_name} {p.last_name}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {p.package_name || 'Package'} | {formatDateTime(p.paid_at)}
                    </span>
                  </span>
                  <span className="text-right">
                    {formatMoney(p.amount_cents)}
                    <span className="block text-xs text-muted-foreground">{p.status === 'COMPLETED' ? 'Successful' : 'Failed'}</span>
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
