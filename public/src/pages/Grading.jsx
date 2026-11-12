import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { AlertCircleIcon, CheckCircleIcon, PencilIcon, PlusIcon, TrashIcon } from '../components/Icons.jsx';
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

const EMPTY = {
  id: '',
  centre_id: '',
  venue_id: '',
  type: 'MASS',
  title: '',
  starts_at: '',
  ends_at: '',
  rank_ids: [],
  examiner_ids: [],
};

// Datetime inputs use local wall time; the API expects ISO strings. Display in Singapore time.
const fmt = (iso) =>
  new Intl.DateTimeFormat('en-SG', {
    timeZone: 'Asia/Singapore',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));

const toLocalInput = (iso) => {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function Grading() {
  const [sessions, setSessions] = useState([]);
  const [centres, setCentres] = useState([]);
  const [venues, setVenues] = useState([]);
  const [ranks, setRanks] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [open, setOpen] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [candLoading, setCandLoading] = useState(false);
  const [addStudentId, setAddStudentId] = useState('');
  const [resultFor, setResultFor] = useState(null);
  const [promoFor, setPromoFor] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [alert, setAlert] = useState(null);

  const load = useCallback(async () => {
    const [sess, centreList, venueList, rankList, instList, studentList] = await Promise.all([
      api('/api/grading/sessions'),
      api('/api/centres'),
      api('/api/venues'),
      api('/api/lookups/ranks'),
      api('/api/instructors'),
      api('/api/lookups/students'),
    ]);
    setSessions(sess);
    setCentres(centreList.filter((c) => c.is_active));
    setVenues(venueList.filter((v) => v.is_active));
    setRanks(rankList);
    setInstructors(instList.filter((i) => i.is_active));
    setStudents(studentList);
  }, []);

  const loadCandidates = useCallback(async (sessionId) => {
    setCandLoading(true);
    try {
      setCandidates(await api(`/api/grading/sessions/${sessionId}/candidates`));
    } catch (err) {
      setAlert({ error: true, text: err.message });
    } finally {
      setCandLoading(false);
    }
  }, []);

  useEffect(() => {
    load()
      .catch((err) => setAlert({ error: true, text: err.message }))
      .finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    if (open) loadCandidates(open.id);
    else setCandidates([]);
  }, [open, loadCandidates]);

  async function run(action, successText, after) {
    try {
      await action();
      setAlert({ error: false, text: successText });
      await load();
      if (after) await after();
    } catch (err) {
      setAlert({ error: true, text: err.message });
    }
  }

  function save(e) {
    e.preventDefault();
    const { id, ...body } = form;
    const payload = {
      ...body,
      starts_at: new Date(body.starts_at).toISOString(),
      ends_at: new Date(body.ends_at).toISOString(),
      title: body.title || null,
    };
    setForm(null);
    run(
      () =>
        api(id ? `/api/grading/sessions/${id}` : '/api/grading/sessions', {
          method: id ? 'PUT' : 'POST',
          body: JSON.stringify(payload),
        }),
      id ? 'Grading session updated.' : 'Grading session created.'
    );
  }

  const openEdit = (s) =>
    setForm({
      id: s.id,
      centre_id: s.centre_id,
      venue_id: s.venue_id,
      type: s.type,
      title: s.title || '',
      starts_at: toLocalInput(s.starts_at),
      ends_at: toLocalInput(s.ends_at),
      rank_ids: s.rank_ids || [],
      examiner_ids: s.examiner_ids || [],
    });

  const toggle = (key, id) =>
    setForm((f) => ({
      ...f,
      [key]: f[key].includes(id) ? f[key].filter((x) => x !== id) : [...f[key], id],
    }));

  const remove = (s) =>
    setConfirm({
      title: 'Delete grading session?',
      message: 'This removes the session and its registrations. Sessions with results cannot be deleted.',
      confirmLabel: 'Delete',
      danger: true,
      action: () =>
        run(() => api(`/api/grading/sessions/${s.id}`, { method: 'DELETE' }), 'Grading session deleted.', () => setOpen(null)),
    });

  const addCandidate = (e) => {
    e.preventDefault();
    if (!addStudentId) return;
    const sessionId = open.id;
    setAddStudentId('');
    run(
      () => api(`/api/grading/sessions/${sessionId}/candidates`, { method: 'POST', body: JSON.stringify({ student_id: addStudentId }) }),
      'Student registered.',
      () => loadCandidates(sessionId)
    );
  };

  const removeCandidate = (c) => {
    const sessionId = open.id;
    run(
      () => api(`/api/grading/candidates/${c.id}`, { method: 'DELETE' }),
      'Candidate removed.',
      () => loadCandidates(sessionId)
    );
  };

  const recordResult = (outcome, remarks) => {
    const c = resultFor;
    const sessionId = open.id;
    setResultFor(null);
    run(
      () => api(`/api/grading/candidates/${c.id}/result`, { method: 'POST', body: JSON.stringify({ outcome, remarks: remarks || null }) }),
      `${c.first_name} ${c.last_name}: ${outcome === 'PASS' ? 'passed' : 'failed'}.`,
      () => loadCandidates(sessionId)
    );
  };

  const centreName = (id) => centres.find((c) => c.id === id)?.name || '-';
  const venueName = (id) => venues.find((v) => v.id === id)?.name || '-';
  const rankName = (id) => ranks.find((r) => r.id === id)?.name || '-';
  const registeredIds = new Set(candidates.map((c) => c.student_id));
  const availableStudents = students.filter((s) => !registeredIds.has(s.id) && (!open || s.centre_id === open.centre_id));
  const canCreate = centres.length > 0 && venues.length > 0 && ranks.length > 0 && instructors.length > 0;

  return (
    <>
      <PageHeader title="Grading" description="Schedule grading sessions, register candidates and record results.">
        <Button onClick={() => setForm({ ...EMPTY, centre_id: centres[0]?.id || '', venue_id: venues[0]?.id || '' })} disabled={!canCreate}>
          <PlusIcon size={18} />
          New session
        </Button>
      </PageHeader>

      <div className="mb-10 overflow-hidden rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Grading sessions</caption>
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Session</th>
                <th scope="col" className="px-4 py-3 font-medium">Type</th>
                <th scope="col" className="px-4 py-3 font-medium">When</th>
                <th scope="col" className="px-4 py-3 font-medium">Centre / venue</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <SkeletonRows rows={3} cols={5} />}
              {!loading && sessions.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <EmptyState icon={CheckCircleIcon} title="No grading sessions yet" hint="Create a session, then register candidates." />
                  </td>
                </tr>
              )}
              {!loading &&
                sessions.map((s) => (
                  <tr
                    key={s.id}
                    className={`border-t transition-colors duration-200 hover:bg-muted/60 ${open?.id === s.id ? 'bg-muted/60' : ''}`}
                  >
                    <td className="px-4 py-3 font-medium">{s.title || `${s.type === 'PRIVATE' ? 'Private' : 'Mass'} grading`}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.type === 'PRIVATE' ? 'Private' : 'Mass'}</td>
                    <td className="px-4 py-3 tabular-nums">{fmt(s.starts_at)}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {centreName(s.centre_id)} / {venueName(s.venue_id)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="secondary" onClick={() => setOpen(open?.id === s.id ? null : s)} aria-expanded={open?.id === s.id}>
                          {open?.id === s.id ? 'Close' : 'Candidates'}
                        </Button>
                        <IconButton label="Edit session" onClick={() => openEdit(s)}>
                          <PencilIcon size={18} />
                        </IconButton>
                        <IconButton label="Delete session" tone="danger" onClick={() => remove(s)}>
                          <TrashIcon size={18} />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {open && (
        <section aria-labelledby="candidates-title" className="rounded-xl border bg-card p-4 sm:p-6">
          <h2 id="candidates-title" className="text-lg font-semibold">
            Candidates: {open.title || (open.type === 'PRIVATE' ? 'Private grading' : 'Mass grading')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Warnings show eligibility issues. You can still register a student after confirming them.
          </p>

          <form onSubmit={addCandidate} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Field label="Add student">
                <select value={addStudentId} onChange={(e) => setAddStudentId(e.target.value)} className={inputClass}>
                  <option value="">Select a student</option>
                  {availableStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.first_name} {s.last_name} ({s.rank_name})
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Button type="submit" disabled={!addStudentId}>
              <PlusIcon size={18} />
              Register
            </Button>
          </form>

          <div className="mt-6 overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Candidates for this session</caption>
              <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Student</th>
                  <th scope="col" className="px-4 py-3 font-medium">Grading from</th>
                  <th scope="col" className="px-4 py-3 font-medium">Warnings</th>
                  <th scope="col" className="px-4 py-3 font-medium">Result</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {candLoading && <SkeletonRows rows={2} cols={5} />}
                {!candLoading && candidates.length === 0 && (
                  <tr>
                    <td colSpan={5}>
                      <EmptyState icon={CheckCircleIcon} title="No candidates yet" hint="Register students above." />
                    </td>
                  </tr>
                )}
                {!candLoading &&
                  candidates.map((c) => (
                    <tr key={c.id} className="border-t">
                      <td className="px-4 py-3 font-medium">
                        {c.first_name} {c.last_name}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{c.from_rank_name}</td>
                      <td className="px-4 py-3">
                        {c.warnings.length === 0 ? (
                          <span className="text-muted-foreground">None</span>
                        ) : (
                          <ul className="space-y-1">
                            {c.warnings.map((w) => (
                              <li key={w} className="inline-flex items-center gap-1 text-accent-text">
                                <AlertCircleIcon size={14} />
                                {w}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="px-4 py-3">{c.outcome ? c.outcome : <span className="text-muted-foreground">Pending</span>}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {!c.outcome && (
                            <Button variant="secondary" onClick={() => setResultFor(c)}>
                              Record result
                            </Button>
                          )}
                          <Button variant="ghost" onClick={() => setPromoFor(c)}>
                            History
                          </Button>
                          {!c.outcome && (
                            <IconButton label={`Remove ${c.first_name} ${c.last_name}`} tone="danger" onClick={() => removeCandidate(c)}>
                              <TrashIcon size={18} />
                            </IconButton>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {form && (
        <Modal labelledBy="grading-form-title" onClose={() => setForm(null)} className="max-w-lg">
          <form onSubmit={save} className="space-y-4">
            <h2 id="grading-form-title" className="text-lg font-semibold">
              {form.id ? 'Edit grading session' : 'New grading session'}
            </h2>
            <Field label="Title" optional>
              <input maxLength={150} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputClass} data-autofocus />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Centre">
                <select required value={form.centre_id} onChange={(e) => setForm({ ...form, centre_id: e.target.value })} className={inputClass}>
                  {centres.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Venue">
                <select required value={form.venue_id} onChange={(e) => setForm({ ...form, venue_id: e.target.value })} className={inputClass}>
                  {venues.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Type">
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={inputClass}>
                <option value="MASS">Mass grading</option>
                <option value="PRIVATE">Private grading</option>
              </select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Starts">
                <input type="datetime-local" required value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} className={inputClass} />
              </Field>
              <Field label="Ends">
                <input type="datetime-local" required value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} className={inputClass} />
              </Field>
            </div>
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium">Ranks being graded (at least one)</legend>
              <div className="flex flex-wrap gap-3">
                {ranks.map((r) => (
                  <label key={r.id} className="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.rank_ids.includes(r.id)} onChange={() => toggle('rank_ids', r.id)} className="size-4 accent-[var(--accent)]" />
                    {r.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium">Examiners (at least one)</legend>
              <div className="flex flex-wrap gap-3">
                {instructors.map((i) => (
                  <label key={i.id} className="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.examiner_ids.includes(i.id)} onChange={() => toggle('examiner_ids', i.id)} className="size-4 accent-[var(--accent)]" />
                    {i.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setForm(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.rank_ids.length === 0 || form.examiner_ids.length === 0}>
                Save
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {resultFor && (
        <ResultDialog
          candidate={resultFor}
          onCancel={() => setResultFor(null)}
          onSubmit={recordResult}
        />
      )}

      {promoFor && <PromotionDialog candidate={promoFor} rankName={rankName} onClose={() => setPromoFor(null)} />}

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

function ResultDialog({ candidate, onCancel, onSubmit }) {
  const [outcome, setOutcome] = useState('PASS');
  const [remarks, setRemarks] = useState('');
  return (
    <Modal labelledBy="result-title" onClose={onCancel}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(outcome, remarks.trim());
        }}
        className="space-y-4"
      >
        <h2 id="result-title" className="text-lg font-semibold">
          Result: {candidate.first_name} {candidate.last_name}
        </h2>
        <p className="text-sm text-muted-foreground">Results cannot be changed once recorded. A pass promotes the student to the next rank.</p>
        <Field label="Outcome">
          <select value={outcome} onChange={(e) => setOutcome(e.target.value)} className={inputClass} data-autofocus>
            <option value="PASS">Pass</option>
            <option value="FAIL">Fail</option>
          </select>
        </Field>
        <Field label="Remarks" optional>
          <textarea rows={3} maxLength={500} value={remarks} onChange={(e) => setRemarks(e.target.value)} className={inputClass} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit">Save result</Button>
        </div>
      </form>
    </Modal>
  );
}

function PromotionDialog({ candidate, rankName, onClose }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api(`/api/grading/students/${candidate.student_id}/promotions`)
      .then(setRows)
      .catch((err) => setError(err.message));
  }, [candidate.student_id]);

  return (
    <Modal labelledBy="promo-title" onClose={onClose}>
      <div className="space-y-4">
        <h2 id="promo-title" className="text-lg font-semibold">
          Promotion history: {candidate.first_name} {candidate.last_name}
        </h2>
        <p className="text-sm text-muted-foreground">Current rank: {candidate.current_rank_name || rankName(candidate.current_rank_id)}</p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!error && rows === null && <p className="text-sm text-muted-foreground">Loading...</p>}
        {rows && rows.length === 0 && <p className="text-sm text-muted-foreground">No promotions recorded yet.</p>}
        {rows && rows.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {rows.map((p) => (
              <li key={p.id} className="flex justify-between gap-3 px-3 py-2 text-sm">
                <span>
                  {p.from_rank} to {p.to_rank}
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-muted-foreground tabular-nums">
                    {new Intl.DateTimeFormat('en-SG', { timeZone: 'Asia/Singapore', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(p.promoted_at))}
                  </span>
                  <a
                    href={`/api/grading/students/${candidate.student_id}/promotions/${p.id}/certificate`}
                    download
                    className="font-medium text-primary hover:underline"
                  >
                    Certificate PDF
                  </a>
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-end pt-2">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
