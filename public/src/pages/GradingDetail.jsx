// GradingDetail.jsx - full detail page for a single grading session (AS-10, AS-11).
// Reached by clicking a row on the Grading list page (/admin/grading/:id).
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { CheckCircleIcon, PencilIcon, PlusIcon, TrashIcon } from '../components/Icons.jsx';
import { formatDateTime } from '../format.js';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  IconButton,
  Modal,
  PageHeader,
  Toast,
  inputClass,
} from '../components/ui.jsx';

const EMPTY_RESULT = { id: '', student_id: '', graded_for_rank_id: '', instructor_id: '', outcome: 'GRADED', remarks: '' };

const outcomeLabel = (o) => (o === 'GRADED' ? 'Graded' : o === 'NOT_GRADED' ? 'Not graded' : 'Pending');

const toApi = (local) => new Date(`${local}:00+08:00`).toISOString();
const toInput = (iso) => new Date(new Date(iso).getTime() + 8 * 3600 * 1000).toISOString().slice(0, 16);

const SAMPLE_CSV =
  'student_email,rank_graded_for,outcome,grading_instructor,remarks\nstudent@example.com,6th Kyu,Graded,Instructor Name,\n';

export default function GradingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null); // { session, results }
  const [ranks, setRanks] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState(null);       // edit grading session
  const [resultForm, setResultForm] = useState(null);
  const [uploadErrors, setUploadErrors] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [alert, setAlert] = useState(null);

  const load = useCallback(async () => {
    const [detail, rankList, people, studentList] = await Promise.all([
      api(`/api/grading/sessions/${id}`),
      api('/api/lookups/ranks'),
      api('/api/instructors'),
      api('/api/lookups/students'),
    ]);
    setData(detail);
    setRanks(rankList);
    setInstructors(people.filter((i) => i.is_active));
    setStudents(studentList);
  }, [id]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => setAlert({ error: true, text: err.message }))
      .finally(() => setLoading(false));
  }, [load]);

  async function run(action, successText) {
    try {
      await action();
      setAlert({ error: false, text: successText });
      await load();
    } catch (err) {
      setAlert({ error: true, text: err.message });
    }
  }

  async function saveSession(e) {
    e.preventDefault();
    const body = {
      title: form.title || null,
      starts_at: toApi(form.starts_at),
      ends_at: toApi(form.ends_at),
      notes: form.notes || null,
    };
    setForm(null);
    try {
      await api(`/api/grading/sessions/${id}`, { method: 'PUT', body: JSON.stringify(body) });
      setAlert({ error: false, text: 'Grading updated.' });
      await load();
    } catch (err) {
      setAlert({ error: true, text: err.message });
    }
  }

  const removeSession = () =>
    setConfirm({
      title: 'Delete grading?',
      message: 'A grading can only be deleted while it has no results.',
      confirmLabel: 'Delete',
      danger: true,
      action: async () => {
        await api(`/api/grading/sessions/${id}`, { method: 'DELETE' });
        navigate('/admin/grading');
      },
    });

  function saveResult(e) {
    e.preventDefault();
    const { id: rid, student_id, ...rest } = resultForm;
    const body = { ...rest, remarks: rest.remarks || null };
    if (!rid) body.student_id = student_id;
    setResultForm(null);
    run(
      () =>
        api(rid ? `/api/grading/results/${rid}` : `/api/grading/sessions/${id}/results`, {
          method: rid ? 'PUT' : 'POST',
          body: JSON.stringify(body),
        }),
      "Result saved. Use \"Update rank\" on that row to change the student's rank."
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

  async function uploadCsv(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const csv = await file.text();
      const result = await api(`/api/grading/sessions/${id}/results/upload`, {
        method: 'POST',
        body: JSON.stringify({ csv }),
      });
      setUploadErrors(null);
      setAlert({ error: false, text: `${result.created} results uploaded.` });
      await load();
    } catch (err) {
      setUploadErrors(err.message);
      setAlert({ error: true, text: err.message });
    }
  }

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

  const session = data?.session;
  const results = data?.results ?? [];

  return (
    <>
      <div className="mb-4">
        <Link to="/admin/grading" className="text-sm font-medium text-accent-text hover:underline">
          ← All gradings
        </Link>
      </div>
      <PageHeader
        title={loading ? 'Grading' : (session?.title || 'Grading')}
        description={session ? formatDateTime(session.starts_at) : ''}
      >
        {session && (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() =>
                setForm({
                  id: session.id,
                  title: session.title || '',
                  starts_at: toInput(session.starts_at),
                  ends_at: toInput(session.ends_at),
                  notes: session.notes || '',
                })
              }
            >
              <PencilIcon size={16} />
              Edit
            </Button>
            <Button variant="danger" onClick={removeSession}>
              <TrashIcon size={16} />
              Delete
            </Button>
          </div>
        )}
      </PageHeader>

      {session?.notes && (
        <p className="mb-4 text-sm text-muted-foreground">{session.notes}</p>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button onClick={() => setResultForm(EMPTY_RESULT)}>
          <PlusIcon size={16} />
          Add result
        </Button>
        <label className="inline-flex h-10 cursor-pointer items-center rounded-lg border border-input bg-card px-4 text-sm font-semibold hover:bg-muted">
          Upload CSV
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={uploadCsv} />
        </label>
        <Button variant="ghost" onClick={downloadSample}>
          Sample CSV
        </Button>
      </div>

      {uploadErrors && (
        <p className="mb-4 rounded-lg bg-destructive-soft p-3 text-sm text-destructive">{uploadErrors}</p>
      )}

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Grading results</caption>
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Student</th>
                <th scope="col" className="px-4 py-3 font-medium">Current rank</th>
                <th scope="col" className="px-4 py-3 font-medium">Graded for</th>
                <th scope="col" className="px-4 py-3 font-medium">Outcome</th>
                <th scope="col" className="px-4 py-3 font-medium">Instructor</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Loading…</td>
                </tr>
              )}
              {!loading && results.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <EmptyState icon={CheckCircleIcon} title="No results yet" hint="Add a result or upload a CSV." />
                  </td>
                </tr>
              )}
              {!loading && results.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{r.first_name} {r.last_name}</td>
                  <td className="px-4 py-3">{r.current_rank_name}</td>
                  <td className="px-4 py-3">{r.graded_for_rank || '-'}</td>
                  <td className="px-4 py-3">{outcomeLabel(r.outcome)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.instructor_name || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        to={`/admin/students?student=${r.student_id}`}
                        className="text-xs font-medium text-accent-text hover:underline"
                      >
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
                      <IconButton
                        label={`Delete result for ${r.first_name} ${r.last_name}`}
                        tone="danger"
                        onClick={() => removeResult(r)}
                      >
                        <TrashIcon size={16} />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit grading session modal */}
      {form && (
        <Modal labelledBy="grading-form-title" onClose={() => setForm(null)}>
          <form onSubmit={saveSession} className="space-y-4">
            <h2 id="grading-form-title" className="text-lg font-semibold">Edit grading</h2>
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
              <Button variant="secondary" onClick={() => setForm(null)}>Cancel</Button>
              <Button type="submit">Save</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add / edit result modal */}
      {resultForm && (
        <Modal labelledBy="result-form-title" onClose={() => setResultForm(null)}>
          <form onSubmit={saveResult} className="space-y-4">
            <h2 id="result-form-title" className="text-lg font-semibold">
              {resultForm.id ? 'Edit result' : 'Add result'}
            </h2>
            <Field label="Student">
              <select
                required
                disabled={Boolean(resultForm.id)}
                value={resultForm.student_id}
                onChange={setResultField('student_id')}
                className={inputClass}
                data-autofocus
              >
                <option value="" disabled>Choose a student</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.first_name} {s.last_name} ({s.rank_name})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Rank graded for">
              <select required value={resultForm.graded_for_rank_id} onChange={setResultField('graded_for_rank_id')} className={inputClass}>
                <option value="" disabled>Choose a rank</option>
                {ranks.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Grading instructor">
              <select required value={resultForm.instructor_id} onChange={setResultField('instructor_id')} className={inputClass}>
                <option value="" disabled>Choose an instructor</option>
                {instructors.map((i) => (
                  <option key={i.id} value={i.id}>{i.name}</option>
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
              <Button variant="secondary" onClick={() => setResultForm(null)}>Cancel</Button>
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
