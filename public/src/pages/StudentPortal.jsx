// StudentPortal.jsx - the student side: current rank, buy a package, record attendance,
// view grading history, attendance history, and class schedule.
import { useCallback, useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { LogOutIcon } from '../components/Icons.jsx';
import { WEEKDAYS, formatDate, formatDateTime, formatMinute, formatMoney } from '../format.js';
import { Button, Toast } from '../components/ui.jsx';

export default function StudentPortal() {
  const { user, logout } = useAuth();
  const [searchParams] = useSearchParams(); // Stripe sends the student back with ?paid=1
  const [rank, setRank] = useState(null);
  const [packages, setPackages] = useState([]);
  const [current, setCurrent] = useState(null); // the student's current package, or null
  const [gradingHistory, setGradingHistory] = useState([]);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [busy, setBusy] = useState(null); // id of the package being paid for, or 'attendance'
  const [alert, setAlert] = useState(null);
  const [verified, setVerified] = useState(null); // null while checking, then true or false

  // Loads rank, packages on sale, the current package, grading history, attendance history, and schedule.
  const load = useCallback(async () => {
    try {
      const [r, list, mine, gh, ah, sch] = await Promise.all([
        api('/api/student/rank'),
        api('/api/student/packages'),
        api('/api/student/package'),
        api('/api/student/grading-history'),
        api('/api/student/attendance-history'),
        api('/api/student/schedule'),
      ]);
      setRank(r);
      setPackages(list);
      setCurrent(mine.package);
      setGradingHistory(gh);
      setAttendanceHistory(ah);
      setSchedule(sch);
    } catch (err) {
      setAlert({ error: true, text: err.message });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // After Stripe redirects back, show a message and reload. The package appears once Stripe's webhook
  // has been received, which can take a few seconds, so the page reloads again shortly after.
  useEffect(() => {
    if (!searchParams.get('paid')) return undefined;
    setAlert({ error: false, text: 'Payment received. Your package will appear once it is confirmed.' });
    load();
    const timer = setTimeout(load, 4000);
    return () => clearTimeout(timer);
  }, [searchParams, load]);

  // Asks the server who holds the session cookie. The browser's stored user can be stale, for example
  // after an admin login in another tab, so it is not trusted for this check. When verification fails
  // we also clear the stored user so the Login page does not redirect back here in a loop.
  useEffect(() => {
    api('/api/student/me')
      .then(() => setVerified(true))
      .catch(() => {
        setVerified(false);
        logout();
      });
  }, []);

  // Only a verified student session may see this page. null means the check is still running.
  if (verified === false || !user) return <Navigate to="/" replace />;
  if (verified === null) return null;

  // Creates a Stripe checkout for the package and sends the browser to Stripe's payment page.
  async function buy(pkg) {
    setBusy(pkg.id);
    try {
      const data = await api(`/api/student/packages/${pkg.id}/checkout`, { method: 'POST' });
      window.location.assign(data.url);
    } catch (err) {
      setAlert({ error: true, text: err.message });
      setBusy(null);
    }
  }

  // Records attendance for today. Each attendance uses up one session of the package.
  async function recordAttendance() {
    setBusy('attendance');
    try {
      const data = await api('/api/student/attendance', { method: 'POST' });
      setCurrent(data.package);
      setAlert({ error: false, text: 'Attendance recorded.' });
      api('/api/student/attendance-history').then(setAttendanceHistory).catch(() => {});
    } catch (err) {
      setAlert({ error: true, text: err.message });
    } finally {
      setBusy(null);
    }
  }

  const name = user.studentDetails ? `${user.studentDetails.first_name} ${user.studentDetails.last_name}` : user.email;
  const hasActive = current && current.is_active;

  return (
    <div className="min-h-screen bg-background">
      <header className="flex h-14 items-center justify-between border-b bg-sidebar px-4 text-white">
        <span className="text-sm font-medium">Aikido Shinjukai | Student portal</span>
        <button type="button" onClick={logout} className="inline-flex items-center gap-2 text-sm hover:underline">
          <LogOutIcon size={16} />
          Log out
        </button>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <h1 className="text-2xl font-semibold">Hello, {name}</h1>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-base font-semibold">Current rank</h2>
          {rank ? (
            <p className="mt-2 text-lg">
              {rank.name}
              {rank.rank_since && <span className="ml-2 text-sm text-muted-foreground">since {formatDate(rank.rank_since)}</span>}
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Loading...</p>
          )}
        </section>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-base font-semibold">Your package</h2>
          {current ? (
            <div className="mt-2 space-y-3">
              <p className="text-sm">
                <strong>{current.name}</strong>. Purchased {formatDate(current.purchased_at)}, expires {formatDate(current.expires_at)}.
              </p>
              <p className="text-sm">
                Sessions used {current.sessions_used} of {current.sessions_total}. {current.sessions_remaining} remaining.
              </p>
              {!hasActive && <p className="text-sm text-muted-foreground">This package has ended. Buy another below to continue.</p>}
              <Button onClick={recordAttendance} disabled={!hasActive || busy === 'attendance'}>
                Record today's attendance
              </Button>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Buy your first package below to start training.</p>
          )}
        </section>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-base font-semibold">Buy a package</h2>
          <p className="mt-1 text-sm text-muted-foreground">Payment is made through Stripe (test mode). You can buy another when you finish early.</p>
          <ul className="mt-3 divide-y">
            {packages.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {p.sessions_total} {p.sessions_total === 1 ? 'session' : 'sessions'}, valid for {p.validity_weeks} weeks
                  </p>
                </div>
                <Button onClick={() => buy(p)} disabled={busy === p.id}>
                  Pay {formatMoney(p.price_cents)}
                </Button>
              </li>
            ))}
            {packages.length === 0 && <li className="py-3 text-sm text-muted-foreground">No packages are on sale.</li>}
          </ul>
        </section>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-base font-semibold">Grading history</h2>
          {gradingHistory.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No gradings recorded yet.</p>
          ) : (
            <ul className="mt-3 divide-y">
              {gradingHistory.map((g, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-medium">{g.rank_name || 'General grading'}</p>
                    <p className="text-sm text-muted-foreground">{g.title || 'Grading session'} | {formatDate(g.starts_at)}</p>
                  </div>
                  <span
                    className={`text-sm font-medium ${
                      g.result === 'PASS' ? 'text-accent-text' : g.result === 'NOT PASSED' ? 'text-destructive' : 'text-muted-foreground'
                    }`}
                  >
                    {g.result || 'Pending'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-base font-semibold">Class schedule</h2>
          {schedule.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No classes scheduled at your centre.</p>
          ) : (
            <ul className="mt-3 divide-y">
              {schedule.map((c, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {WEEKDAYS[c.weekday]} {formatMinute(c.start_minute)} - {formatMinute(c.end_minute)}
                    </p>
                  </div>
                  <span className="text-sm text-muted-foreground">{c.instructor_name || 'Unassigned'}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-base font-semibold">Attendance history</h2>
          {attendanceHistory.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No attendance recorded yet.</p>
          ) : (
            <ul className="mt-3 divide-y">
              {attendanceHistory.map((a, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-3">
                  <span className="font-medium">{formatDate(a.attended_on)}</span>
                  <span className="text-sm text-muted-foreground">{a.package_name}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <Toast alert={alert} onDismiss={() => setAlert(null)} />
    </div>
  );
}
