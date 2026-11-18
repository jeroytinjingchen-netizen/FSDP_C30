// Grading.jsx - admin page to record and review gradings (AS-10, AS-11).
// Gradings are mass events held at HQ only. Each result has a student, the rank graded for, the grading
// instructor and an outcome of Graded or Not graded. Saving a result never changes a rank: the admin
// follows the "Update rank" link to the student's profile and changes it by hand (AS-8).
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useCentre } from '../CentreContext.jsx';
import CentreSwitcher from '../components/CentreSwitcher.jsx';
import { CheckCircleIcon, PencilIcon, PlusIcon, TrashIcon } from '../components/Icons.jsx';
import { formatDate, formatDateTime } from '../format.js';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  IconButton,
  Modal,
  PageHeader,
  SkeletonRows,
  Toast,
  inputClass,
} from '../components/ui.jsx';

// Blank form values for "New grading".
const EMPTY = { id: '', title: '', starts_at: '', ends_at: '', notes: '' };
const EMPTY_RESULT = { id: '', student_id: '', graded_for_rank_id: '', instructor_id: '', outcome: 'GRADED', remarks: '' };

const outcomeLabel = (o) => (o === 'GRADED' ? 'Graded' : o === 'NOT_GRADED' ? 'Not graded' : 'Pending');

// <input type="datetime-local"> has no time zone. The app works in Singapore time (UTC+8), so we add
// "+08:00" when sending, and shift the clock by 8 hours when filling the input from a stored timestamp.
const toApi = (local) => new Date(`${local}:00+08:00`).toISOString();
const toInput = (iso) => new Date(new Date(iso).getTime() + 8 * 3600 * 1000).toISOString().slice(0, 16);

// A sample CSV the admin can download to see the expected columns.
const SAMPLE_CSV =
  'student_email,rank_graded_for,outcome,grading_instructor,remarks\nstudent@example.com,6th Kyu,Graded,Instructor Name,\n';

export default function Grading() {
  const { centreId } = useCentre();
  const [sessions, setSessions] = useState([]);
  const [ranks, setRanks] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [students, setStudents] = useState([]);
  const [rankFilter, setRankFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null); // new/edit grading dialog
  const [open, setOpen] = useState(null); // { session, results } for the opened grading
  const [resultForm, setResultForm] = useState(null); // add/edit result dialog
  const [uploadErrors, setUploadErrors] = useState(null); // row problems from a failed CSV upload
  const [confirm, setConfirm] = useState(null);
  const [alert, setAlert] = useState(null);

  // Loads the grading list with the active filters (centre, rank, date range) and the dropdown data.
  const load = useCallback(async () => {
    const q = new URLSearchParams();
    if (centreId) q.set('centreId', centreId);
    if (rankFilter) q.set('rankId', rankFilter);
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    const qs = q.toString();
    const [list, rankList, people, studentList] = await Promise.all([
      api(`/api/grading/sessions${qs ? `?${qs}` : ''}`),
      api('/api/lookups/ranks'),
      api('/api/instructors'),
      api('/api/lookups/students'),
    ]);
    setSessions(list);
    setRanks(rankList);
    setInstructors(people.filter((i) => i.is_active));
    setStudents(studentList);
  }, [centreId, rankFilter, from, to]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => setAlert({ error: true, text: err.message }))
      .finally(() => setLoading(false));
  }, [load]);

  // Opens a grading and loads its results. The centre and rank filters also narrow the results shown.
  const openSession = useCallback(
    async (id) => {
      try {
        const q = new URLSearchParams();
        if (centreId) q.set('centreId', centreId);
        if (rankFilter) q.set('rankId', rankFilter);
        const qs = q.toString();
        setOpen(await api(`/api/grading/sessions/${id}${qs ? `?${qs}` : ''}`));
      } catch (err) {
        setAlert({ error: true, text: err.message });
      }
    },
    [centreId, rankFilter]
  );

  // Runs an API action, shows a toast, then reloads the list and the opened grading.
  async function run(action, successText) {
    try {
      await action();
      setAlert({ error: false, text: successText });
      await load();
      if (open) await openSession(open.session.id);
    } catch (err) {
      setAlert({ error: true, text: err.message });
    }
  }

  // Saves a grading (date and time at HQ). The centre is always HQ, so it is not sent.
  async function saveSession(e) {
    e.preventDefault();
    const body = {
      title: form.title || null,
      starts_at: toApi(form.starts_at),
      ends_at: toApi(form.ends_at),
      notes: form.notes || null,
    };
    const id = form.id;
    setForm(null);
    try {
      const saved = await api(id ? `/api/grading/sessions/${id}` : '/api/grading/sessions', {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(body),
      });
      setAlert({ error: false, text: id ? 'Grading updated.' : 'Grading created.' });
      await load();
      await openSession(saved.id);
    } catch (err) {
      setAlert({ error: true, text: err.message });
    }
  }

  const removeSession = (s) =>
    setConfirm({
      title: 'Delete grading?',
      message: 'A grading can only be deleted while it has no results.',
      confirmLabel: 'Delete',
      danger: true,
      action: async () => {
        setOpen(null);
        await run(() => api(`/api/grading/sessions/${s.id}`, { method: 'DELETE' }), 'Grading deleted.');
      },
    });

  // Saves one result: PUT when editing, POST when adding.
  function saveResult(e) {
    e.preventDefault();
    const { id, student_id, ...rest } = resultForm;
    const body = { ...rest, remarks: rest.remarks || null };
    if (!id) body.student_id = student_id;
    setResultForm(null);
    run(
      () =>
        api(id ? `/api/grading/results/${id}` : `/api/grading/sessions/${open.session.id}/results`, {
          method: id ? 'PUT' : 'POST',
          body: JSON.stringify(body),
        }),
      'Result saved. Use "Update rank" on that row to change the student\'s rank.'
    );
  }

  const removeResult = (r) =>
    setConfirm({
      title: 'Delete result?',
      message: `Remove the result for ${r.first_name} ${r.last_name}?`,
      confirmLabel: 'Delete',
      danger: true,
      action: () => run(() => api(`/api/grading/results/${r.id}`, { method: 'DELETE' }), 'Result deleted.'),
    });

  // Reads a chosen CSV file in the browser (FileReader API via file.text()) and uploads its text.
  // The server saves all rows or none. If any row is wrong it returns the list of problems.
  async function uploadCsv(e) {
    const file = e.target.files[0];
    e.target.value = ''; // lets the same file be chosen again
    if (!file) return;
    try {
      const csv = await file.text();
      const data = await api(`/api/grading/sessions/${open.session.id}/results/upload`, {
        method: 'POST',
        body: JSON.stringify({ csv }),
      });
      setUploadErrors(null);
      setAlert({ error: false, text: `${data.created} results uploaded.` });
      await load();
      await openSession(open.session.id);
    } catch (err) {
      // api() throws only the message; re-fetch is not needed. Show a hint and keep the message.
      setUploadErrors(err.message);
      setAlert({ error: true, text: err.message });
    }
  }

  // Downloads the sample CSV. A Blob is an in-memory file; URL.createObjectURL makes a temporary link to it.
  function downloadSample() {
    const url = URL.createObjectURL(new Blob([SAMPLE_CSV], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'grading_results_sample.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const setField = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const setResultField = (key) => (e) => setResultForm({ ...resultForm, [key]: e.target.value });

  return (
    <>
      <PageHeader title="Grading" description="Gradings are held at HQ. Record each centre's results here.">
        <Button onClick={() => setForm(EMPTY)}>
          <PlusIcon size={18} />
          New grading
        </Button>
      </PageHeader>

      {/* Separate the filters from the heading so every control has enough room. */}
      <section aria-label="Grading filters" className="mb-6 rounded-xl border bg-card p-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className="flex min-w-0 flex-col gap-1.5 text-sm">
            <span className="font-medium text-muted-foreground">Centre</span>
            <CentreSwitcher />
          </label>
          <label className="flex min-w-0 flex-col gap-1.5 text-sm">
            <span className="font-medium text-muted-foreground">Rank</span>
            <select aria-label="Filter by rank" value={rankFilter} onChange={(e) => setRankFilter(e.target.value)} className={inputClass}>
              <option value="">All ranks</option>
              {ranks.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-0 flex-col gap-1.5 text-sm">
            <span className="font-medium text-muted-foreground">From date</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
          </label>
          <label className="flex min-w-0 flex-col gap-1.5 text-sm">
            <span className="font-medium text-muted-foreground">To date</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} />
          </label>
        </div>
        {(centreId || rankFilter || from || to) && (
          <div className="mt-4 flex justify-end border-t pt-3">
            <Button
              variant="ghost"
              onClick={() => {
                setRankFilter('');
                setFrom('');
                setTo('');
              }}
            >
              Clear filters
            </Button>
          </div>
        )}
      </section>

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Gradings</caption>
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Date</th>
                <th scope="col" className="px-4 py-3 font-medium">Grading</th>
                <th scope="col" className="px-4 py-3 font-medium">Venue</th>
                <th scope="col" className="px-4 py-3 font-medium">Students</th>
                <th scope="col" className="px-4 py-3 font-medium">Graded</th>
                <th scope="col" className="px-4 py-3 font-medium">Not graded</th>
              </tr>
            </thead>
            <tbody>
              {loading && <SkeletonRows rows={4} cols={6} />}
              {!loading && sessions.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <EmptyState icon={CheckCircleIcon} title="No gradings found" hint="Create a grading, or change the filters." />
                  </td>
                </tr>
              )}
              {!loading &&
                sessions.map((s) => (
                  <tr key={s.id} className="border-t transition-colors duration-200 hover:bg-muted/60">
                    <td className="px-4 py-3">{formatDate(s.starts_at)}</td>
                    <td className="px-4 py-3 font-medium">
                      <button type="button" onClick={() => openSession(s.id)} className="text-left text-accent-text hover:underline">
                        {s.title || 'Grading'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{s.centre_name}</td>
                    <td className="px-4 py-3 font-mono tabular-nums">{s.student_count}</td>
                    <td className="px-4 py-3 font-mono tabular-nums">{s.graded_count}</td>
                    <td className="px-4 py-3 font-mono tabular-nums">{s.not_graded_count}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {form && (
        <Modal labelledBy="grading-form-title" onClose={() => setForm(null)}>
          <form onSubmit={saveSession} className="space-y-4">
            <h2 id="grading-form-title" className="text-lg font-semibold">
              {form.id ? 'Edit grading' : 'New grading'}
            </h2>
            <p className="text-sm text-muted-foreground">Held at HQ.</p>
            <Field label="Title" optional>
              <input maxLength={150} value={form.title} onChange={setField('title')} className={inputClass} data-autofocus />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Starts">
                <input required type="datetime-local" value={form.starts_at} onChange={setField('starts_at')} className={inputClass} />
              </Field>
              <Field label="Ends">
                <input required type="datetime-local" value={form.ends_at} onChange={setField('ends_at')} className={inputClass} />
              </Field>
            </div>
            <Field label="Notes" optional>
              <textarea maxLength={1000} rows={3} value={form.notes} onChange={setField('notes')} className={`${inputClass} h-auto py-2`} />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setForm(null)}>
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </div>
          </form>
        </Modal>
      )}

      {open && (
        <Modal labelledBy="grading-detail-title" onClose={() => { setOpen(null); setUploadErrors(null); }} className="max-w-4xl">
          <div className="max-h-[80vh] space-y-4 overflow-y-auto pr-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 id="grading-detail-title" className="text-lg font-semibold">
                  {open.session.title || 'Grading'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {open.session.centre_name} | {formatDateTime(open.session.starts_at)}
                </p>
                {open.session.notes && <p className="mt-1 text-sm text-muted-foreground">{open.session.notes}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => setForm({ id: open.session.id, title: open.session.title || '', starts_at: toInput(open.session.starts_at), ends_at: toInput(open.session.ends_at), notes: open.session.notes || '' })}>
                  <PencilIcon size={16} />
                  Edit
                </Button>
                <Button variant="danger" onClick={() => removeSession(open.session)}>
                  <TrashIcon size={16} />
                  Delete
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => setResultForm(EMPTY_RESULT)}>
                <PlusIcon size={16} />
                Add result
              </Button>
              {/* The label wraps a hidden file input so the styled label acts as the upload button */}
              <label className="inline-flex h-10 cursor-pointer items-center rounded-lg border border-input bg-card px-4 text-sm font-semibold hover:bg-muted">
                Upload CSV
                <input type="file" accept=".csv,text/csv" className="sr-only" onChange={uploadCsv} />
              </label>
              <Button variant="ghost" onClick={downloadSample}>
                Sample CSV
              </Button>
            </div>
            {uploadErrors && <p className="rounded-lg bg-destructive-soft p-3 text-sm text-destructive">{uploadErrors}</p>}

            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">Student</th>
                    <th scope="col" className="px-3 py-2 font-medium">Centre</th>
                    <th scope="col" className="px-3 py-2 font-medium">Current rank</th>
                    <th scope="col" className="px-3 py-2 font-medium">Graded for</th>
                    <th scope="col" className="px-3 py-2 font-medium">Outcome</th>
                    <th scope="col" className="px-3 py-2 font-medium">Instructor</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {open.results.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                        No results yet.
                      </td>
                    </tr>
                  )}
                  {open.results.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="px-3 py-2 font-medium">
                        {r.first_name} {r.last_name}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{r.centre_name}</td>
                      <td className="px-3 py-2">{r.current_rank_name}</td>
                      <td className="px-3 py-2">{r.graded_for_rank || '-'}</td>
                      <td className="px-3 py-2">{outcomeLabel(r.outcome)}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.instructor_name || '-'}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          {/* Opens the student's profile with the rank update form (AS-8) */}
                          <Link to={`/admin/students?student=${r.student_id}`} className="text-xs font-medium text-accent-text hover:underline">
                            Update rank
                          </Link>
                          <IconButton
                            label={`Edit result for ${r.first_name} ${r.last_name}`}
                            onClick={() =>
                              setResultForm({
                                id: r.id,
                                student_id: r.student_id,
                                graded_for_rank_id: r.graded_for_rank_id || '',
                                instructor_id: r.instructor_id || '',
                                outcome: r.outcome || 'GRADED',
                                remarks: r.remarks || '',
                              })
                            }
                          >
                            <PencilIcon size={16} />
                          </IconButton>
                          <IconButton label={`Delete result for ${r.first_name} ${r.last_name}`} tone="danger" onClick={() => removeResult(r)}>
                            <TrashIcon size={16} />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => { setOpen(null); setUploadErrors(null); }}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {resultForm && (
        <Modal labelledBy="result-form-title" onClose={() => setResultForm(null)}>
          <form onSubmit={saveResult} className="space-y-4">
            <h2 id="result-form-title" className="text-lg font-semibold">
              {resultForm.id ? 'Edit result' : 'Add result'}
            </h2>
            <Field label="Student">
              {/* The student cannot be changed on an existing result */}
              <select required disabled={Boolean(resultForm.id)} value={resultForm.student_id} onChange={setResultField('student_id')} className={inputClass} data-autofocus>
                <option value="" disabled>
                  Choose a student
                </option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.first_name} {s.last_name} ({s.rank_name})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Rank graded for">
              <select required value={resultForm.graded_for_rank_id} onChange={setResultField('graded_for_rank_id')} className={inputClass}>
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
            <Field label="Grading instructor">
              <select required value={resultForm.instructor_id} onChange={setResultField('instructor_id')} className={inputClass}>
                <option value="" disabled>
                  Choose an instructor
                </option>
                {instructors.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Outcome">
              <select value={resultForm.outcome} onChange={setResultField('outcome')} className={inputClass}>
                <option value="GRADED">Graded</option>
                <option value="NOT_GRADED">Not graded</option>
              </select>
            </Field>
            <Field label="Remarks" optional>
              <input maxLength={500} value={resultForm.remarks} onChange={setResultField('remarks')} className={inputClass} />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setResultForm(null)}>
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </div>
          </form>
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
