// Students.jsx - admin page to list, search, add and edit students, and open a student's profile (AS-7, AS-8, AS-9, AS-11, AS-12).
// The profile shows contact details, rank and rank history, the active package with sessions used and
// remaining, payment history, and grading history. Payment and grading records are read-only here.
// Ranks never change automatically: the admin changes one with the "Update rank" form on the profile.
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useCentre } from '../CentreContext.jsx';
import CentreSwitcher from '../components/CentreSwitcher.jsx';
import { ArchiveIcon, CalendarIcon, PencilIcon, PlusIcon, RestoreIcon } from '../components/Icons.jsx';
import { formatDate, formatDateTime, formatMoney } from '../format.js';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  IconButton,
  Modal,
  PageHeader,
  SkeletonRows,
  StatusBadge,
  Toast,
  inputClass,
} from '../components/ui.jsx';

// Blank form values for "Add student".
const EMPTY = {
  id: '',
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  date_of_birth: '',
  guardian_name: '',
  guardian_phone: '',
  centre_id: '',
  current_rank_id: '',
};

// The API stores a payment status as COMPLETED or FAILED. Admins see Successful or Failed.
const paymentLabel = (status) => (status === 'COMPLETED' ? 'Successful' : 'Failed');
// Grading outcome labels. null means the result has not been recorded yet.
const outcomeLabel = (o) => (o === 'GRADED' ? 'Graded' : o === 'NOT_GRADED' ? 'Not graded' : 'Pending');

// A titled block inside the profile dialog.
function Section({ title, children }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

// A small read-only table used for the history lists. columns = [{ label, render(row) }].
function MiniTable({ columns, rows, empty }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-xs">
        <thead className="bg-muted uppercase tracking-wide text-muted-foreground">
          <tr>
            {columns.map((c) => (
              <th key={c.label} scope="col" className="px-3 py-2 font-medium">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              {columns.map((c) => (
                <td key={c.label} className="px-3 py-2">
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Students() {
  const { centreId } = useCentre();
  // useSearchParams reads and writes the URL query string. "?student=<id>" opens that student's profile,
  // which is how the Grading page links to the rank update after a result is saved.
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [centres, setCentres] = useState([]);
  const [ranks, setRanks] = useState([]);
  const [search, setSearch] = useState('');
  const [rankFilter, setRankFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null); // add/edit dialog
  const [profile, setProfile] = useState(null); // profile dialog data
  const [rankForm, setRankForm] = useState({ rank_id: '', changed_on: '', note: '' });
  const [confirm, setConfirm] = useState(null);
  const [alert, setAlert] = useState(null);

  // Loads the student list with the active filters, plus centres and ranks for the dropdowns.
  const load = useCallback(async () => {
    const q = new URLSearchParams();
    if (search.trim()) q.set('q', search.trim());
    if (centreId) q.set('centreId', centreId);
    if (rankFilter) q.set('rankId', rankFilter);
    const qs = q.toString();
    const [list, centreList, rankList] = await Promise.all([
      api(`/api/students${qs ? `?${qs}` : ''}`),
      api('/api/centres'),
      api('/api/lookups/ranks'),
    ]);
    setRows(list);
    setCentres(centreList.filter((c) => c.is_active));
    setRanks(rankList);
  }, [search, centreId, rankFilter]);

  // Reload when a filter changes. The timer waits 250 ms after the last keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      load()
        .catch((err) => setAlert({ error: true, text: err.message }))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [load]);

  // Fetches one student's full profile and opens the profile dialog.
  const openProfile = useCallback(async (id) => {
    try {
      const data = await api(`/api/students/${id}`);
      setProfile(data);
      setRankForm({ rank_id: '', changed_on: '', note: '' });
    } catch (err) {
      setAlert({ error: true, text: err.message });
    }
  }, []);

  // If the URL has ?student=<id>, open that profile once.
  const linkedStudent = params.get('student');
  useEffect(() => {
    if (linkedStudent) openProfile(linkedStudent);
  }, [linkedStudent, openProfile]);

  const closeProfile = () => {
    setProfile(null);
    if (params.get('student')) setParams({}, { replace: true });
  };

  // Runs an API action, shows a toast, then reloads the list.
  async function run(action, successText) {
    try {
      await action();
      setAlert({ error: false, text: successText });
      await load();
    } catch (err) {
      setAlert({ error: true, text: err.message });
    }
  }

  // Saves the add/edit form. Empty optional fields are sent as null.
  function save(e) {
    e.preventDefault();
    const { id, ...body } = form;
    const payload = {
      ...body,
      phone: body.phone || null,
      date_of_birth: body.date_of_birth || null,
      guardian_name: body.guardian_name || null,
      guardian_phone: body.guardian_phone || null,
    };
    // The rank is only sent when creating. Existing students change rank on the profile instead.
    if (id) delete payload.current_rank_id;
    setForm(null);
    run(
      () => api(id ? `/api/students/${id}` : '/api/students', { method: id ? 'PUT' : 'POST', body: JSON.stringify(payload) }),
      id ? 'Student updated.' : 'Student added.'
    );
  }

  const openEdit = (s) =>
    setForm({
      id: s.id,
      first_name: s.first_name,
      last_name: s.last_name,
      email: s.email,
      phone: s.phone || '',
      date_of_birth: s.date_of_birth || '',
      guardian_name: s.guardian_name || '',
      guardian_phone: s.guardian_phone || '',
      centre_id: s.centre_id,
      current_rank_id: s.current_rank_id,
    });

  // Saves a manual rank change, then refreshes the profile so the new rank and history show.
  async function submitRank(e) {
    e.preventDefault();
    const body = { rank_id: rankForm.rank_id, note: rankForm.note || null };
    if (rankForm.changed_on) body.changed_on = rankForm.changed_on;
    try {
      await api(`/api/students/${profile.student.id}/rank`, { method: 'POST', body: JSON.stringify(body) });
      setAlert({ error: false, text: 'Rank updated.' });
      await openProfile(profile.student.id);
      await load();
    } catch (err) {
      setAlert({ error: true, text: err.message });
    }
  }

  const toggleActive = (s) =>
    setConfirm({
      title: s.is_active ? 'Deactivate student?' : 'Activate student?',
      message: `${s.first_name} ${s.last_name} will be ${s.is_active ? 'marked as inactive' : 'marked as active again'}.`,
      confirmLabel: s.is_active ? 'Deactivate' : 'Activate',
      danger: s.is_active,
      action: () =>
        run(
          () => api(`/api/students/${s.id}/${s.is_active ? 'deactivate' : 'activate'}`, { method: 'POST' }),
          s.is_active ? 'Student deactivated.' : 'Student activated.'
        ),
    });

  const setField = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  return (
    <>
      <PageHeader title="Students" description="Student records across all centres.">
        <Button onClick={() => setForm({ ...EMPTY, centre_id: centreId || '' })}>
          <PlusIcon size={18} />
          Add student
        </Button>
      </PageHeader>

      {/* Keep the three list filters together on desktop; stack them on smaller screens. */}
      <section aria-label="Student filters" className="mb-4 grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_10rem]">
        <input
          type="search"
          aria-label="Search students"
          placeholder="Search name or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={inputClass}
        />
        <CentreSwitcher />
        <select aria-label="Filter by rank" value={rankFilter} onChange={(e) => setRankFilter(e.target.value)} className={inputClass}>
          <option value="">All ranks</option>
          {ranks.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </section>

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Students</caption>
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Name</th>
                <th scope="col" className="px-4 py-3 font-medium">Email</th>
                <th scope="col" className="px-4 py-3 font-medium">Centre</th>
                <th scope="col" className="px-4 py-3 font-medium">Rank</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <SkeletonRows rows={4} cols={6} />}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <EmptyState icon={CalendarIcon} title="No students found" hint="Add a student, or change the filters." />
                  </td>
                </tr>
              )}
              {!loading &&
                rows.map((s) => (
                  <tr key={s.id} className="border-t transition-colors duration-200 hover:bg-muted/60">
                    <td className="px-4 py-3 font-medium">
                      {/* Clicking the name opens the profile */}
                      <button type="button" onClick={() => openProfile(s.id)} className="text-left text-accent-text hover:underline">
                        {s.first_name} {s.last_name}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{s.email}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.centre_name}</td>
                    <td className="px-4 py-3">{s.rank_name}</td>
                    <td className="px-4 py-3">
                      <StatusBadge active={s.is_active} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <IconButton label={`Edit ${s.first_name} ${s.last_name}`} onClick={() => openEdit(s)}>
                          <PencilIcon size={18} />
                        </IconButton>
                        <IconButton
                          label={`${s.is_active ? 'Deactivate' : 'Activate'} ${s.first_name} ${s.last_name}`}
                          tone={s.is_active ? 'warning' : 'success'}
                          onClick={() => toggleActive(s)}
                        >
                          {s.is_active ? <ArchiveIcon size={18} /> : <RestoreIcon size={18} />}
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {form && (
        <Modal labelledBy="student-form-title" onClose={() => setForm(null)}>
          <form onSubmit={save} className="space-y-4">
            <h2 id="student-form-title" className="text-lg font-semibold">
              {form.id ? 'Edit student' : 'Add student'}
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <Field label="First name">
                <input required maxLength={80} value={form.first_name} onChange={setField('first_name')} className={inputClass} data-autofocus />
              </Field>
              <Field label="Last name">
                <input required maxLength={80} value={form.last_name} onChange={setField('last_name')} className={inputClass} />
              </Field>
            </div>
            <Field label="Email">
              <input required type="email" value={form.email} onChange={setField('email')} className={inputClass} />
            </Field>
            <Field label="Phone" optional>
              <input maxLength={30} value={form.phone} onChange={setField('phone')} className={inputClass} />
            </Field>
            <Field label="Date of birth" optional>
              <input type="date" value={form.date_of_birth} onChange={setField('date_of_birth')} className={inputClass} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Guardian name" optional>
                <input maxLength={150} value={form.guardian_name} onChange={setField('guardian_name')} className={inputClass} />
              </Field>
              <Field label="Guardian phone" optional>
                <input maxLength={30} value={form.guardian_phone} onChange={setField('guardian_phone')} className={inputClass} />
              </Field>
            </div>
            <Field label="Centre">
              <select required value={form.centre_id} onChange={setField('centre_id')} className={inputClass}>
                <option value="" disabled>
                  Choose a centre
                </option>
                {centres.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            {/* Rank can be chosen only for a new student. Later changes are logged on the profile. */}
            {!form.id && (
              <Field label="Starting rank">
                <select required value={form.current_rank_id} onChange={setField('current_rank_id')} className={inputClass}>
                  <option value="" disabled>
                    Choose a rank
                  </option>
                  {ranks.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setForm(null)}>
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </div>
          </form>
        </Modal>
      )}

      {profile && (
        <Modal labelledBy="profile-title" onClose={closeProfile} className="max-w-3xl">
          <div className="max-h-[80vh] space-y-5 overflow-y-auto pr-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="profile-title" className="text-lg font-semibold">
                  {profile.student.first_name} {profile.student.last_name}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {profile.student.centre_name} | Current rank: <strong>{profile.student.rank_name}</strong>
                  {profile.student.rank_since && ` (since ${formatDate(profile.student.rank_since)})`}
                </p>
              </div>
              <Button variant="secondary" onClick={closeProfile}>
                Close
              </Button>
            </div>

            <Section title="Contact">
              <p className="text-sm text-muted-foreground">
                {profile.student.email} | {profile.student.phone || 'No phone'}
                {profile.student.guardian_name && ` | Guardian: ${profile.student.guardian_name} ${profile.student.guardian_phone || ''}`}
              </p>
            </Section>

            <Section title="Active package">
              {profile.package ? (
                <p className="text-sm">
                  <strong>{profile.package.name}</strong>. Purchased {formatDate(profile.package.purchased_at)}, expires{' '}
                  {formatDate(profile.package.expires_at)}. Sessions used {profile.package.sessions_used} of{' '}
                  {profile.package.sessions_total}, {profile.package.sessions_remaining} remaining.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">No active package.</p>
              )}
            </Section>

            <Section title="Update rank">
              {/* HQ decides ranks. Nothing here runs automatically. Each change is saved with a date. */}
              <form onSubmit={submitRank} className="grid gap-3 sm:grid-cols-4">
                <select required aria-label="New rank" value={rankForm.rank_id} onChange={(e) => setRankForm({ ...rankForm, rank_id: e.target.value })} className={inputClass}>
                  <option value="" disabled>
                    New rank
                  </option>
                  {ranks.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <input type="date" aria-label="Date of change" value={rankForm.changed_on} onChange={(e) => setRankForm({ ...rankForm, changed_on: e.target.value })} className={inputClass} />
                <input aria-label="Note" maxLength={300} placeholder="Note (optional)" value={rankForm.note} onChange={(e) => setRankForm({ ...rankForm, note: e.target.value })} className={inputClass} />
                <Button type="submit">Save rank</Button>
              </form>
            </Section>

            <Section title="Rank history">
              <MiniTable
                rows={profile.rankHistory}
                empty="No rank changes recorded."
                columns={[
                  { label: 'Date', render: (r) => formatDate(r.promoted_at) },
                  { label: 'From', render: (r) => r.from_rank || '-' },
                  { label: 'To', render: (r) => r.to_rank },
                  { label: 'Note', render: (r) => r.note || '-' },
                ]}
              />
            </Section>

            <Section title="Grading history">
              <MiniTable
                rows={profile.gradings}
                empty="Not graded yet."
                columns={[
                  { label: 'Date', render: (r) => formatDate(r.starts_at) },
                  { label: 'Graded for', render: (r) => r.graded_for_rank || '-' },
                  { label: 'Outcome', render: (r) => outcomeLabel(r.outcome) },
                  { label: 'Instructor', render: (r) => r.instructor_name || '-' },
                ]}
              />
            </Section>

            <Section title="Payment history">
              <MiniTable
                rows={profile.payments}
                empty="No payments."
                columns={[
                  { label: 'Paid', render: (r) => formatDateTime(r.paid_at) },
                  { label: 'Package', render: (r) => r.package_name || '-' },
                  { label: 'Amount', render: (r) => formatMoney(r.amount_cents) },
                  { label: 'Reference', render: (r) => r.reference },
                  { label: 'Status', render: (r) => paymentLabel(r.status) },
                ]}
              />
            </Section>
          </div>
        </Modal>
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          danger={confirm.danger}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            const { action } = confirm;
            setConfirm(null);
            action();
          }}
        />
      )}

      <Toast alert={alert} onDismiss={() => setAlert(null)} />
    </>
  );
}
