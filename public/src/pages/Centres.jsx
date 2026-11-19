// Centres.jsx - admin page to add, edit, archive and delete training centres (AS-3).
// A centre is the actual venue. Its weekly schedule is read-only here: it is built from the centre's classes.
// React hooks used: useState (component data), useEffect (run code after render), useCallback (keep a stable function).
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { formatSlot } from '../format.js';
import { useCentre } from '../CentreContext.jsx';
import { ArchiveIcon, BuildingIcon, PencilIcon, PlusIcon, RestoreIcon, TrashIcon } from '../components/Icons.jsx';
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

// Blank form values for "New centre".
const EMPTY = { id: '', name: '', address: '', email: '', phone: '' };

export default function Centres() {
  // refreshCentres reloads the shared centre list used by the centre switcher.
  const { refreshCentres } = useCentre();
  const [rows, setRows] = useState([]); // centres from the API
  // loading shows skeleton rows; form is the open add/edit dialog (null = closed); confirm is the confirm dialog
  // showArchived toggles archived centres; alert is the toast message
  // (these hooks are declared below)
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [alert, setAlert] = useState(null);

  // Fetches centres. useCallback keeps the same function between renders unless showArchived changes.
  const load = useCallback(async () => {
    setRows(await api(`/api/centres?includeArchived=${showArchived}`));
    await refreshCentres();
  }, [showArchived, refreshCentres]);

  // Load on first render and whenever load() changes.
  useEffect(() => {
    load()
      .catch((err) => setAlert({ error: true, text: err.message }))
      .finally(() => setLoading(false));
  }, [load]);

  // Runs an API action, shows a success or error toast, then reloads the list.
  async function run(action, successText) {
    try {
      await action();
      setAlert({ error: false, text: successText });
      await load();
    } catch (err) {
      setAlert({ error: true, text: err.message });
    }
  }

  // Submits the form: PUT to update when an id exists, otherwise POST to create.
  // const { id, ...body } = form  splits the id from the remaining fields (object rest syntax).
  function save(e) {
    e.preventDefault();
    const { id, name, address, email, phone } = form;
    const body = { name, address, email, phone };
    setForm(null);
    run(
      () =>
        api(id ? `/api/centres/${id}` : '/api/centres', {
          method: id ? 'PUT' : 'POST',
          body: JSON.stringify(body),
        }),
      id ? 'Centre updated.' : 'Centre created.'
    );
  }

  // Helpers that open the confirm dialog before a destructive action.
  const ask = (config) => setConfirm(config);
  const archive = (c) =>
    ask({
      title: 'Archive centre?',
      message: `"${c.name}" will be hidden from active lists. You can restore it later.`,
      confirmLabel: 'Archive',
      action: () => run(() => api(`/api/centres/${c.id}/archive`, { method: 'POST' }), 'Centre archived.'),
    });
  const remove = (c) =>
    ask({
      title: 'Delete centre permanently?',
      message: `"${c.name}" will be deleted. This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
      action: () => run(() => api(`/api/centres/${c.id}`, { method: 'DELETE' }), 'Centre deleted.'),
    });
  const restore = (c) => run(() => api(`/api/centres/${c.id}/restore`, { method: 'POST' }), 'Centre restored.');

  // Returns an onChange handler that updates one form field (a function that returns a function).
  const setField = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  return (
    <>
      <PageHeader title="Training centres" description="Manage the locations where classes are held.">
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
        <Button onClick={() => setForm(EMPTY)}>
          <PlusIcon size={18} />
          New centre
        </Button>
      </PageHeader>

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Training centres</caption>
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Name</th>
                <th scope="col" className="px-4 py-3 font-medium">Address</th>
                <th scope="col" className="px-4 py-3 font-medium">Weekly schedule</th>
                <th scope="col" className="px-4 py-3 font-medium">Students</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <SkeletonRows rows={4} cols={6} />}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      icon={BuildingIcon}
                      title="No centres yet"
                      hint="Create your first centre, then add classes to it."
                      action={
                        <Button onClick={() => setForm(EMPTY)}>
                          <PlusIcon size={18} />
                          New centre
                        </Button>
                      }
                    />
                  </td>
                </tr>
              )}
              {!loading &&
                rows.map((c) => (
                  <tr key={c.id} className="border-t transition-colors duration-200 hover:bg-muted/60">
                    <td className={cn('px-4 py-3 font-medium', !c.is_active && 'text-muted-foreground')}>{c.name}{c.is_hq && <span className="ml-2 text-xs font-normal text-muted-foreground">(HQ)</span>}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.address}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {/* schedule comes from the centre's classes, e.g. "Saturday 10:00am - 11:00am" */}
                      {c.schedule.length === 0 ? 'No classes yet' : c.schedule.map((s) => <div key={s.id}>{formatSlot(s)}</div>)}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums">{c.student_count}</td>
                    <td className="px-4 py-3">
                      <StatusBadge active={c.is_active} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <IconButton
                          label={`Edit ${c.name}`}
                          onClick={() => setForm({ ...EMPTY, ...c, email: c.email || '', phone: c.phone || '' })}
                        >
                          <PencilIcon size={18} />
                        </IconButton>
                        {c.is_active ? (
                          <IconButton label={`Archive ${c.name}`} tone="warning" onClick={() => archive(c)}>
                            <ArchiveIcon size={18} />
                          </IconButton>
                        ) : (
                          <IconButton label={`Restore ${c.name}`} tone="success" onClick={() => restore(c)}>
                            <RestoreIcon size={18} />
                          </IconButton>
                        )}
                        <IconButton label={`Delete ${c.name}`} tone="danger" onClick={() => remove(c)}>
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
        <Modal labelledBy="centre-form-title" onClose={() => setForm(null)}>
          <form onSubmit={save} className="space-y-4">
            <h2 id="centre-form-title" className="text-lg font-semibold">
              {form.id ? 'Edit centre' : 'New centre'}
            </h2>
            <Field label="Name">
              <input required maxLength={150} value={form.name} onChange={setField('name')} className={inputClass} data-autofocus />
            </Field>
            <Field label="Address">
              <input required maxLength={300} value={form.address} onChange={setField('address')} className={inputClass} />
            </Field>
            <Field label="Email" optional>
              <input type="email" value={form.email} onChange={setField('email')} className={inputClass} />
            </Field>
            <Field label="Phone" optional>
              <input maxLength={30} value={form.phone} onChange={setField('phone')} className={inputClass} />
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


