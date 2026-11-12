import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { CalendarIcon, PencilIcon, PlusIcon, TrashIcon } from '../components/Icons.jsx';
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

const EMPTY = { id: '', centre_id: '', name: '', start_date: '', end_date: '' };

// API stores dates as UTC instants for Singapore midnight, so format in SGT to avoid a one-day shift.
const sgDate = (iso) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore' }).format(new Date(iso));
const displayDate = (iso) =>
  new Intl.DateTimeFormat('en-SG', { timeZone: 'Asia/Singapore', day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(iso)
  );

export default function Terms() {
  const [rows, setRows] = useState([]);
  const [centres, setCentres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [alert, setAlert] = useState(null);

  const load = useCallback(async () => {
    const [terms, centreList] = await Promise.all([api('/api/terms'), api('/api/centres')]);
    setRows(terms);
    setCentres(centreList.filter((c) => c.is_active));
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
    const { id, ...body } = form;
    setForm(null);
    run(
      () =>
        api(id ? `/api/terms/${id}` : '/api/terms', {
          method: id ? 'PUT' : 'POST',
          body: JSON.stringify(body),
        }),
      id ? 'Term updated.' : 'Term created.'
    );
  }

  const remove = (t) =>
    setConfirm({
      title: 'Delete term?',
      message: `"${t.name}" will be deleted. This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
      action: () => run(() => api(`/api/terms/${t.id}`, { method: 'DELETE' }), 'Term deleted.'),
    });

  const setField = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const openEdit = (t) =>
    setForm({
      id: t.id,
      centre_id: t.centre_id,
      name: t.name,
      start_date: sgDate(t.start_date),
      end_date: sgDate(t.end_date),
    });

  return (
    <>
      <PageHeader title="Terms" description="Set the teaching terms for each centre. Terms cannot overlap within a centre.">
        <Button onClick={() => setForm({ ...EMPTY, centre_id: centres[0]?.id || '' })} disabled={centres.length === 0}>
          <PlusIcon size={18} />
          New term
        </Button>
      </PageHeader>

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Terms by centre</caption>
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Term</th>
                <th scope="col" className="px-4 py-3 font-medium">Centre</th>
                <th scope="col" className="px-4 py-3 font-medium">Dates</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <SkeletonRows rows={4} cols={4} />}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={4}>
                    <EmptyState
                      icon={CalendarIcon}
                      title="No terms yet"
                      hint="Add a term to start planning classes for a centre."
                    />
                  </td>
                </tr>
              )}
              {!loading &&
                rows.map((t) => (
                  <tr key={t.id} className="border-t transition-colors duration-200 hover:bg-muted/60">
                    <td className="px-4 py-3 font-medium">{t.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{t.centre_name}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {displayDate(t.start_date)} to {displayDate(t.end_date)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
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

      {form && (
        <Modal labelledBy="term-form-title" onClose={() => setForm(null)}>
          <form onSubmit={save} className="space-y-4">
            <h2 id="term-form-title" className="text-lg font-semibold">
              {form.id ? 'Edit term' : 'New term'}
            </h2>
            <Field label="Centre">
              <select required value={form.centre_id} onChange={setField('centre_id')} className={inputClass} data-autofocus>
                <option value="" disabled>
                  Select a centre
                </option>
                {centres.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Term name">
              <input required maxLength={100} value={form.name} onChange={setField('name')} className={inputClass} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Start date">
                <input type="date" required value={form.start_date} onChange={setField('start_date')} className={inputClass} />
              </Field>
              <Field label="End date">
                <input
                  type="date"
                  required
                  min={form.start_date || undefined}
                  value={form.end_date}
                  onChange={setField('end_date')}
                  className={inputClass}
                />
              </Field>
            </div>
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
