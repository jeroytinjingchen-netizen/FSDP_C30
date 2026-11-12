import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { AlertCircleIcon, CalendarIcon, PencilIcon, PlusIcon, TrashIcon } from '../components/Icons.jsx';
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

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const EMPTY = {
  id: '',
  term_id: '',
  venue_id: '',
  level_rank_id: '',
  name: '',
  weekday: 0,
  start: '18:00',
  end: '19:30',
  instructor_ids: [],
};

const toTime = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const toMinutes = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

// Timestamps are shown in Singapore time
const fmt = (iso) =>
  new Intl.DateTimeFormat('en-SG', {
    timeZone: 'Asia/Singapore',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));

export default function Classes() {
  const [templates, setTemplates] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [conflicts, setConflicts] = useState({ count: 0, conflicts: [] });
  const [terms, setTerms] = useState([]);
  const [venues, setVenues] = useState([]);
  const [ranks, setRanks] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [alert, setAlert] = useState(null);

  const load = useCallback(async () => {
    const [tpl, sess, conf, termList, venueList, rankList, instList] = await Promise.all([
      api('/api/classes/templates'),
      api('/api/classes/sessions'),
      api('/api/classes/conflicts'),
      api('/api/terms'),
      api('/api/venues'),
      api('/api/lookups/ranks'),
      api('/api/instructors'),
    ]);
    setTemplates(tpl);
    setSessions(sess);
    setConflicts(conf);
    setTerms(termList);
    setVenues(venueList.filter((v) => v.is_active));
    setRanks(rankList);
    setInstructors(instList.filter((i) => i.is_active));
  }, []);

  useEffect(() => {
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

  function save(e) {
    e.preventDefault();
    const { id, start, end, ...rest } = form;
    const payload = {
      ...rest,
      weekday: Number(rest.weekday),
      level_rank_id: rest.level_rank_id || null,
      start_minute: toMinutes(start),
      end_minute: toMinutes(end),
    };
    setForm(null);
    run(
      () =>
        api(id ? `/api/classes/templates/${id}` : '/api/classes/templates', {
          method: id ? 'PUT' : 'POST',
          body: JSON.stringify(payload),
        }),
      id ? 'Class template updated.' : 'Class template created.'
    );
  }

  const openEdit = (t) =>
    setForm({
      id: t.id,
      term_id: t.term_id,
      venue_id: t.venue_id,
      level_rank_id: t.level_rank_id || '',
      name: t.name,
      weekday: t.weekday,
      start: toTime(t.start_minute),
      end: toTime(t.end_minute),
      instructor_ids: (t.instructors || []).map((i) => i.id),
    });

  const toggleInstructor = (id) =>
    setForm((f) => ({
      ...f,
      instructor_ids: f.instructor_ids.includes(id)
        ? f.instructor_ids.filter((x) => x !== id)
        : [...f.instructor_ids, id],
    }));

  const remove = (t) =>
    setConfirm({
      title: 'Delete class template?',
      message: `"${t.name}" and its generated sessions will be removed.`,
      confirmLabel: 'Delete',
      danger: true,
      action: () => run(() => api(`/api/classes/templates/${t.id}`, { method: 'DELETE' }), 'Class template deleted.'),
    });

  const generate = (t) =>
    run(async () => {
      const data = await api(`/api/classes/templates/${t.id}/generate`, { method: 'POST' });
      setAlert({ error: false, text: `${data.created} session(s) generated for ${t.name}.` });
    }, `Generating sessions for ${t.name}.`);

  const setSessionStatus = (s, status) =>
    run(
      () => api(`/api/classes/sessions/${s.id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
      `Session marked ${status.toLowerCase()}.`
    );

  const termName = (id) => terms.find((t) => t.id === id)?.name || '-';
  const canCreate = terms.length > 0 && venues.length > 0;

  return (
    <>
      <PageHeader title="Classes" description="Create weekly class templates, generate sessions per term and check for clashes.">
        <Button onClick={() => setForm({ ...EMPTY, term_id: terms[0]?.id || '', venue_id: venues[0]?.id || '' })} disabled={!canCreate}>
          <PlusIcon size={18} />
          New class template
        </Button>
      </PageHeader>

      {conflicts.count > 0 && (
        <div role="alert" className="mb-6 flex gap-3 rounded-xl border border-accent/40 bg-accent-soft p-4 text-sm text-accent-text">
          <AlertCircleIcon size={20} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">{conflicts.count} scheduling conflict(s) found</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {conflicts.conflicts.slice(0, 5).map((c, idx) => (
                <li key={idx}>
                  {c.kind === 'INSTRUCTOR' ? `${c.subject} is double-booked` : `${c.subject} is double-booked at this venue`} ({fmt(c.starts_at)})
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <h2 className="mb-3 text-lg font-semibold">Templates</h2>
      <div className="mb-10 overflow-hidden rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Class templates</caption>
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Class</th>
                <th scope="col" className="px-4 py-3 font-medium">Term</th>
                <th scope="col" className="px-4 py-3 font-medium">When</th>
                <th scope="col" className="px-4 py-3 font-medium">Venue</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <SkeletonRows rows={3} cols={5} />}
              {!loading && templates.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <EmptyState icon={CalendarIcon} title="No class templates yet" hint="Create a template, then generate its sessions for the term." />
                  </td>
                </tr>
              )}
              {!loading &&
                templates.map((t) => (
                  <tr key={t.id} className="border-t transition-colors duration-200 hover:bg-muted/60">
                    <td className="px-4 py-3 font-medium">
                      {t.name}
                      {t.level_rank_name && <span className="ml-2 text-xs text-muted-foreground">{t.level_rank_name}</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{t.term_name}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {WEEKDAYS[t.weekday]} {toTime(t.start_minute)}-{toTime(t.end_minute)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{t.venue_name}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="secondary" onClick={() => generate(t)}>
                          Generate sessions
                        </Button>
                        <IconButton label={`Edit ${t.name}`} onClick={() => openEdit(t)}>
                          <PencilIcon size={18} />
                        </IconButton>
                        <IconButton label={`Delete ${t.name}`} tone="danger" onClick={() => remove(t)}>
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

      <h2 className="mb-3 text-lg font-semibold">Upcoming sessions</h2>
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Generated class sessions</caption>
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Starts</th>
                <th scope="col" className="px-4 py-3 font-medium">Class</th>
                <th scope="col" className="px-4 py-3 font-medium">Instructors</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {!loading && sessions.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <EmptyState icon={CalendarIcon} title="No sessions yet" hint="Generate sessions from a template to see them here." />
                  </td>
                </tr>
              )}
              {!loading &&
                sessions.slice(0, 100).map((s) => (
                  <tr key={s.id} className="border-t transition-colors duration-200 hover:bg-muted/60">
                    <td className="px-4 py-3 tabular-nums">{fmt(s.starts_at)}</td>
                    <td className="px-4 py-3 font-medium">
                      {s.template_name} <span className="text-xs text-muted-foreground">{s.venue_name}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{s.instructors.map((i) => i.name).join(', ') || 'Unassigned'}</td>
                    <td className="px-4 py-3">{s.status}</td>
                    <td className="px-4 py-3 text-right">
                      <select
                        aria-label={`Status for ${s.template_name} on ${fmt(s.starts_at)}`}
                        value={s.status}
                        onChange={(e) => setSessionStatus(s, e.target.value)}
                        className={inputClass + ' w-auto py-1'}
                      >
                        <option value="SCHEDULED">Scheduled</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="CANCELLED">Cancelled</option>
                      </select>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {form && (
        <Modal labelledBy="class-form-title" onClose={() => setForm(null)} className="max-w-lg">
          <form onSubmit={save} className="space-y-4">
            <h2 id="class-form-title" className="text-lg font-semibold">
              {form.id ? 'Edit class template' : 'New class template'}
            </h2>
            <Field label="Class name">
              <input required maxLength={150} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} data-autofocus />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Term">
                <select required value={form.term_id} onChange={(e) => setForm({ ...form, term_id: e.target.value })} className={inputClass}>
                  {terms.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({termName(t.id)})
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
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Day">
                <select value={form.weekday} onChange={(e) => setForm({ ...form, weekday: e.target.value })} className={inputClass}>
                  {WEEKDAYS.map((d, n) => (
                    <option key={d} value={n}>
                      {d}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Start">
                <input type="time" required value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} className={inputClass} />
              </Field>
              <Field label="End">
                <input type="time" required value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} className={inputClass} />
              </Field>
            </div>
            <Field label="Level" optional>
              <select value={form.level_rank_id} onChange={(e) => setForm({ ...form, level_rank_id: e.target.value })} className={inputClass}>
                <option value="">All levels</option>
                {ranks.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </Field>
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium">Instructors</legend>
              <div className="flex flex-wrap gap-3">
                {instructors.map((i) => (
                  <label key={i.id} className="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.instructor_ids.includes(i.id)} onChange={() => toggleInstructor(i.id)} className="size-4 accent-[var(--accent)]" />
                    {i.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setForm(null)}>
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
