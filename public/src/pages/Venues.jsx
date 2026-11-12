import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { useCentre } from '../CentreContext.jsx';
import { ArchiveIcon, MapPinIcon, PencilIcon, PlusIcon, RestoreIcon, TrashIcon } from '../components/Icons.jsx';
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
  cn,
  inputClass,
} from '../components/ui.jsx';

const EMPTY = { id: '', centre_id: '', name: '', capacity: '' };

export default function Venues() {
  const { centres, centreId } = useCentre();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [alert, setAlert] = useState(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (centreId) params.set('centreId', centreId);
    if (showArchived) params.set('includeArchived', 'true');
    const qs = params.toString();
    setRows(await api(`/api/venues${qs ? `?${qs}` : ''}`));
  }, [centreId, showArchived]);

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
    const { id, centre_id, ...fields } = form;
    const body = { ...fields, capacity: Number(fields.capacity) };
    setForm(null);
    if (id) {
      run(() => api(`/api/venues/${id}`, { method: 'PUT', body: JSON.stringify(body) }), 'Venue updated.');
    } else {
      run(
        () => api('/api/venues', { method: 'POST', body: JSON.stringify({ ...body, centre_id }) }),
        'Venue created.'
      );
    }
  }

  const archive = (v) =>
    setConfirm({
      title: 'Archive venue?',
      message: `"${v.name}" will be hidden from active lists. You can restore it later.`,
      confirmLabel: 'Archive',
      action: () => run(() => api(`/api/venues/${v.id}/archive`, { method: 'POST' }), 'Venue archived.'),
    });
  const remove = (v) =>
    setConfirm({
      title: 'Delete venue permanently?',
      message: `"${v.name}" will be deleted. This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
      action: () => run(() => api(`/api/venues/${v.id}`, { method: 'DELETE' }), 'Venue deleted.'),
    });
  const restore = (v) => run(() => api(`/api/venues/${v.id}/restore`, { method: 'POST' }), 'Venue restored.');

  const setField = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const openNew = () =>
    setForm({ ...EMPTY, centre_id: centreId || centres.find((c) => c.is_active)?.id || '' });

  return (
    <>
      <PageHeader title="Training venues" description="Rooms and halls where classes take place.">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            className="size-4 accent-accent"
            checked={showArchived}
            onChange={(e) => {
              setLoading(true);
              setShowArchived(e.target.checked);
            }}
          />
          Show archived
        </label>
        <Button onClick={openNew} disabled={centres.length === 0}>
          <PlusIcon size={18} />
          New venue
        </Button>
      </PageHeader>

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Training venues</caption>
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Name</th>
                <th scope="col" className="px-4 py-3 font-medium">Centre</th>
                <th scope="col" className="px-4 py-3 font-medium">Capacity</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <SkeletonRows rows={4} cols={5} />}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <EmptyState
                      icon={MapPinIcon}
                      title="No venues yet"
                      hint={
                        centres.length === 0
                          ? 'Create a centre first, then add venues to it.'
                          : 'Add a venue to this view to get started.'
                      }
                      action={
                        centres.length > 0 && (
                          <Button onClick={openNew}>
                            <PlusIcon size={18} />
                            New venue
                          </Button>
                        )
                      }
                    />
                  </td>
                </tr>
              )}
              {!loading &&
                rows.map((v) => (
                  <tr key={v.id} className="border-t transition-colors duration-200 hover:bg-muted/60">
                    <td className={cn('px-4 py-3 font-medium', !v.is_active && 'text-muted-foreground')}>{v.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{v.centre_name}</td>
                    <td className="px-4 py-3 font-mono tabular-nums">{v.capacity}</td>
                    <td className="px-4 py-3">
                      <StatusBadge active={v.is_active} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <IconButton
                          label={`Edit ${v.name}`}
                          onClick={() =>
                            setForm({ id: v.id, centre_id: v.centre_id, name: v.name, capacity: String(v.capacity) })
                          }
                        >
                          <PencilIcon size={18} />
                        </IconButton>
                        {v.is_active ? (
                          <IconButton label={`Archive ${v.name}`} tone="warning" onClick={() => archive(v)}>
                            <ArchiveIcon size={18} />
                          </IconButton>
                        ) : (
                          <IconButton label={`Restore ${v.name}`} tone="success" onClick={() => restore(v)}>
                            <RestoreIcon size={18} />
                          </IconButton>
                        )}
                        <IconButton label={`Delete ${v.name}`} tone="danger" onClick={() => remove(v)}>
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
        <Modal labelledBy="venue-form-title" onClose={() => setForm(null)}>
          <form onSubmit={save} className="space-y-4">
            <h2 id="venue-form-title" className="text-lg font-semibold">
              {form.id ? 'Edit venue' : 'New venue'}
            </h2>
            <Field label="Centre">
              {form.id ? (
                <input
                  disabled
                  value={centres.find((c) => c.id === form.centre_id)?.name || 'Archived centre'}
                  className={inputClass}
                />
              ) : (
                <select required value={form.centre_id} onChange={setField('centre_id')} className={inputClass}>
                  <option value="" disabled>
                    Select a centre
                  </option>
                  {centres
                    .filter((c) => c.is_active)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              )}
            </Field>
            <Field label="Name">
              <input required maxLength={150} value={form.name} onChange={setField('name')} className={inputClass} data-autofocus />
            </Field>
            <Field label="Capacity">
              <input
                type="number"
                required
                min={1}
                step={1}
                value={form.capacity}
                onChange={setField('capacity')}
                className={inputClass}
              />
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
