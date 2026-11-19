// Grading.jsx - list of grading sessions (AS-10, AS-11).
// Clicking a row navigates to /admin/grading/:id for the full detail page.
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { CheckCircleIcon, PlusIcon } from '../components/Icons.jsx';
import { formatDate } from '../format.js';
import {
  Button,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  SkeletonRows,
  Toast,
  inputClass,
} from '../components/ui.jsx';

const EMPTY = { id: '', title: '', starts_at: '', ends_at: '', notes: '' };

const toApi = (local) => new Date(`${local}:00+08:00`).toISOString();

export default function Grading() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [ranks, setRanks] = useState([]);
  const [rankFilter, setRankFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [alert, setAlert] = useState(null);

  const load = useCallback(async () => {
    const q = new URLSearchParams();
    if (rankFilter) q.set('rankId', rankFilter);
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    const qs = q.toString();
    const [list, rankList] = await Promise.all([
      api(`/api/grading/sessions${qs ? `?${qs}` : ''}`),
      api('/api/lookups/ranks'),
    ]);
    setSessions(list);
    setRanks(rankList);
  }, [rankFilter, from, to]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => setAlert({ error: true, text: err.message }))
      .finally(() => setLoading(false));
  }, [load]);

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
      navigate(`/admin/grading/${saved.id}`);
    } catch (err) {
      setAlert({ error: true, text: err.message });
    }
  }

  const setField = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  return (
    <>
      <PageHeader title="Grading" description="Gradings are held at HQ. Record each centre's results here.">
        <Button onClick={() => setForm(EMPTY)}>
          <PlusIcon size={18} />
          New grading
        </Button>
      </PageHeader>

      <section aria-label="Grading filters" className="mb-6 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-muted-foreground">Rank</span>
            <select aria-label="Filter by rank" value={rankFilter} onChange={(e) => setRankFilter(e.target.value)} className={inputClass}>
              <option value="">All ranks</option>
              {ranks.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-muted-foreground">From date</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-muted-foreground">To date</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} />
          </label>
          {(rankFilter || from || to) && (
            <Button variant="ghost" onClick={() => { setRankFilter(''); setFrom(''); setTo(''); }}>
              Clear filters
            </Button>
          )}
        </div>
      </section>

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Gradings</caption>
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Date</th>
                <th scope="col" className="px-4 py-3 font-medium">Students</th>
                <th scope="col" className="px-4 py-3 font-medium">Graded</th>
                <th scope="col" className="px-4 py-3 font-medium">Not graded</th>
                <th scope="col" className="px-4 py-3 font-medium">Pending</th>
              </tr>
            </thead>
            <tbody>
              {loading && <SkeletonRows rows={4} cols={5} />}
              {!loading && sessions.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <EmptyState icon={CheckCircleIcon} title="No gradings found" hint="Create a grading, or change the filters." />
                  </td>
                </tr>
              )}
              {!loading &&
                sessions.map((s) => (
                  <tr
                    key={s.id}
                    className="cursor-pointer border-t transition-colors duration-200 hover:bg-muted/60"
                    onClick={() => navigate(`/admin/grading/${s.id}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-accent-text">{formatDate(s.starts_at)}</div>
                      {s.title ? <div className="text-muted-foreground">{s.title}</div> : null}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums">{s.student_count}</td>
                    <td className="px-4 py-3 font-mono tabular-nums">{s.graded_count}</td>
                    <td className="px-4 py-3 font-mono tabular-nums">{s.not_graded_count}</td>
                    <td className="px-4 py-3 font-mono tabular-nums text-muted-foreground">
                      {s.student_count - s.graded_count - s.not_graded_count}
                    </td>
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
              <Button variant="secondary" onClick={() => setForm(null)}>Cancel</Button>
              <Button type="submit">Save</Button>
            </div>
          </form>
        </Modal>
      )}

      <Toast alert={alert} onDismiss={() => setAlert(null)} />
    </>
  );
}
