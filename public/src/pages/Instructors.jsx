// Instructors.jsx - admin page to add, edit, search and deactivate instructors (AS-5, AS-6).
// Instructors do not log in, so this is only a record of their contact details, rank or
// qualifications, and the classes they are posted to. There is no availability editor.
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { useCentre } from '../CentreContext.jsx';
import CentreSwitcher from '../components/CentreSwitcher.jsx';
import { ArchiveIcon, CalendarIcon, PencilIcon, PlusIcon, RestoreIcon } from '../components/Icons.jsx';
import { formatSlot } from '../format.js';
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

// Blank form values for "Add instructor".
const EMPTY = { id: '', name: '', email: '', phone: '', rank_id: '', qualifications: '' };

export default function Instructors() {
  const { centreId } = useCentre();
  const [rows, setRows] = useState([]);
  const [ranks, setRanks] = useState([]);
  const [search, setSearch] = useState(''); // text typed in the search box
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [alert, setAlert] = useState(null);

  // Loads instructors. URLSearchParams builds the query string safely (it escapes special characters).
  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('q', search.trim());
    if (centreId) params.set('centreId', centreId);
    const qs = params.toString();
    const [list, rankList] = await Promise.all([api(`/api/instructors${qs ? `?${qs}` : ''}`), api('/api/lookups/ranks')]);
    setRows(list);
    setRanks(rankList);
  }, [search, centreId]);

  // Re-load when the search text or centre changes. The 250 ms timer waits until the user stops typing.
  // Returning a function from useEffect cleans up: here it cancels the timer if the effect re-runs.
  useEffect(() => {
    const timer = setTimeout(() => {
      load()
        .catch((err) => setAlert({ error: true, text: err.message }))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [load]);

  // Runs an API action, shows a toast, then reloads.
  async function run(action, successText) {
    try {
      await action();
      setAlert({ error: false, text: successText });
      await load();
    } catch (err) {
      setAlert({ error: true, text: err.message });
    }
  }

  // Saves the form: PUT when editing, POST when adding. An empty rank is sent as null.
  function save(e) {
    e.preventDefault();
    const { id, ...body } = form;
    const payload = { ...body, rank_id: body.rank_id || null };
    setForm(null);
    run(
      () => api(id ? `/api/instructors/${id}` : '/api/instructors', { method: id ? 'PUT' : 'POST', body: JSON.stringify(payload) }),
      id ? 'Instructor updated.' : 'Instructor added.'
    );
  }

  // Opens the dialog with an instructor's current details (null values become empty strings for the inputs).
  const openEdit = (i) =>
    setForm({
      id: i.id,
      name: i.name,
      email: i.email || '',
      phone: i.phone || '',
      rank_id: i.rank_id || '',
      qualifications: i.qualifications || '',
    });

  // Asks for confirmation, then deactivates or reactivates the instructor.
  const toggleActive = (i) =>
    setConfirm({
      title: i.is_active ? 'Deactivate instructor?' : 'Activate instructor?',
      message: `${i.name} will be ${i.is_active ? 'marked as no longer active' : 'marked as active again'}.`,
      confirmLabel: i.is_active ? 'Deactivate' : 'Activate',
      danger: i.is_active,
      action: () =>
        run(
          () => api(`/api/instructors/${i.id}/${i.is_active ? 'deactivate' : 'activate'}`, { method: 'POST' }),
          i.is_active ? 'Instructor deactivated.' : 'Instructor activated.'
        ),
    });

  const setField = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  return (
    <>
      <PageHeader title="Instructors" description="Contact details, rank and the classes each instructor is posted to.">
        <input
          type="search"
          aria-label="Search instructors"
          placeholder="Search name, email or phone"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${inputClass} w-64`}
        />
        <div className="w-56">
          <CentreSwitcher />
        </div>
        <Button onClick={() => setForm(EMPTY)}>
          <PlusIcon size={18} />
          Add instructor
        </Button>
      </PageHeader>

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Instructors</caption>
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Name</th>
                <th scope="col" className="px-4 py-3 font-medium">Contact</th>
                <th scope="col" className="px-4 py-3 font-medium">Rank / qualifications</th>
                <th scope="col" className="px-4 py-3 font-medium">Assigned classes</th>
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
                      icon={CalendarIcon}
                      title="No instructors found"
                      hint="Add an instructor, or change the search."
                    />
                  </td>
                </tr>
              )}
              {!loading &&
                rows.map((i) => (
                  <tr key={i.id} className="border-t align-top transition-colors duration-200 hover:bg-muted/60">
                    <td className="px-4 py-3 font-medium">{i.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <div>{i.email || '-'}</div>
                      <div>{i.phone || '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <div>{i.rank_name || '-'}</div>
                      {i.qualifications && <div className="text-xs">{i.qualifications}</div>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {/* classes is a JSON array built by the API: one line per class the instructor teaches */}
                      {i.classes.length === 0
                        ? 'None'
                        : i.classes.map((c) => (
                            <div key={c.id}>
                              {c.centre_name}: {formatSlot(c)}
                            </div>
                          ))}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge active={i.is_active} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <IconButton label={`Edit ${i.name}`} onClick={() => openEdit(i)}>
                          <PencilIcon size={18} />
                        </IconButton>
                        <IconButton
                          label={`${i.is_active ? 'Deactivate' : 'Activate'} ${i.name}`}
                          tone={i.is_active ? 'warning' : 'success'}
                          onClick={() => toggleActive(i)}
                        >
                          {i.is_active ? <ArchiveIcon size={18} /> : <RestoreIcon size={18} />}
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
        <Modal labelledBy="instructor-form-title" onClose={() => setForm(null)}>
          <form onSubmit={save} className="space-y-4">
            <h2 id="instructor-form-title" className="text-lg font-semibold">
              {form.id ? 'Edit instructor' : 'Add instructor'}
            </h2>
            <Field label="Name">
              <input required maxLength={150} value={form.name} onChange={setField('name')} className={inputClass} data-autofocus />
            </Field>
            <Field label="Email" optional>
              <input type="email" value={form.email} onChange={setField('email')} className={inputClass} />
            </Field>
            <Field label="Phone" optional>
              <input maxLength={30} value={form.phone} onChange={setField('phone')} className={inputClass} />
            </Field>
            <Field label="Rank" optional>
              <select value={form.rank_id} onChange={setField('rank_id')} className={inputClass}>
                <option value="">No rank</option>
                {ranks.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Qualifications" optional>
              <textarea maxLength={500} rows={3} value={form.qualifications} onChange={setField('qualifications')} className={`${inputClass} h-auto py-2`} />
            </Field>
            <p className="text-xs text-muted-foreground">Classes are assigned from the Classes page.</p>
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
