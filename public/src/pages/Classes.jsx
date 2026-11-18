// Classes.jsx - admin page to create, edit and remove classes, and assign an instructor to each (AS-4, AS-6).
// A class belongs to one centre and repeats weekly on a day and time. There are no terms or venues.
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { useCentre } from '../CentreContext.jsx';
import CentreSwitcher from '../components/CentreSwitcher.jsx';
import { CalendarIcon, PencilIcon, PlusIcon, TrashIcon } from '../components/Icons.jsx';
import { WEEKDAYS, formatSlot, minuteToTime, timeToMinute } from '../format.js';
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

export default function Classes() {
  // centreId is the centre picked in the switcher (null = all). centres is the shared centre list.
  const { centres, centreId, centreQuery } = useCentre();
  const [classes, setClasses] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null); // open add/edit dialog, or null
  const [confirm, setConfirm] = useState(null); // open confirm dialog, or null
  const [alert, setAlert] = useState(null); // toast message

  // Loads classes (filtered by centre) and the instructor list in parallel with Promise.all.
  // centreQuery() gives "?centreId=..." or "" when All centres is selected.
  const load = useCallback(async () => {
    const [list, people] = await Promise.all([api(`/api/classes${centreQuery()}`), api('/api/instructors')]);
    setClasses(list);
    setInstructors(people);
  }, [centreQuery]);

  // Reload whenever the selected centre changes.
  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => setAlert({ error: true, text: err.message }))
      .finally(() => setLoading(false));
  }, [centreId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Opens the dialog with a blank class. Defaults to the selected centre, else the first active one.
  function openNew() {
    const firstActive = centres.find((c) => c.is_active);
    setForm({
      id: '',
      name: '',
      centre_id: centreId || (firstActive ? firstActive.id : ''),
      weekday: 5,
      start: '10:00',
      end: '11:00',
    });
  }

  // Opens the dialog filled with an existing class (minutes are converted to "HH:MM" for the time inputs).
  const openEdit = (c) =>
    setForm({
      id: c.id,
      name: c.name,
      centre_id: c.centre_id,
      weekday: c.weekday,
      start: minuteToTime(c.start_minute),
      end: minuteToTime(c.end_minute),
    });

  // Saves the class: PUT when editing, POST when creating. Times go to the API as minutes after midnight.
  function save(e) {
    e.preventDefault();
    const body = {
      name: form.name,
      centre_id: form.centre_id,
      weekday: Number(form.weekday),
      start_minute: timeToMinute(form.start),
      end_minute: timeToMinute(form.end),
    };
    const id = form.id;
    setForm(null);
    run(
      () => api(id ? `/api/classes/${id}` : '/api/classes', { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) }),
      id ? 'Class updated.' : 'Class created.'
    );
  }

  const remove = (c) =>
    setConfirm({
      title: 'Remove class?',
      message: `"${c.name}" will be removed from the schedule.`,
      confirmLabel: 'Remove',
      danger: true,
      action: () => run(() => api(`/api/classes/${c.id}`, { method: 'DELETE' }), 'Class removed.'),
    });

  // Assigns, reassigns or removes the instructor. An empty choice sends null, which removes the instructor.
  const assign = (c, instructorId) =>
    run(
      () => api(`/api/classes/${c.id}/instructor`, { method: 'PUT', body: JSON.stringify({ instructor_id: instructorId || null }) }),
      instructorId ? 'Instructor assigned.' : 'Instructor removed.'
    );

  const setField = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  return (
    <>
      <PageHeader title="Classes" description="Weekly classes at each centre, and who teaches them.">
        <div className="w-56">
          <CentreSwitcher />
        </div>
        <Button onClick={openNew}>
          <PlusIcon size={18} />
          New class
        </Button>
      </PageHeader>

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Classes</caption>
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Class</th>
                <th scope="col" className="px-4 py-3 font-medium">Centre</th>
                <th scope="col" className="px-4 py-3 font-medium">Day and time</th>
                <th scope="col" className="px-4 py-3 font-medium">Instructor</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <SkeletonRows rows={4} cols={5} />}
              {!loading && classes.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <EmptyState
                      icon={CalendarIcon}
                      title="No classes yet"
                      hint="Create a class to add it to its centre's schedule."
                      action={
                        <Button onClick={openNew}>
                          <PlusIcon size={18} />
                          New class
                        </Button>
                      }
                    />
                  </td>
                </tr>
              )}
              {!loading &&
                classes.map((c) => (
                  <tr key={c.id} className="border-t transition-colors duration-200 hover:bg-muted/60">
                    <td className="px-4 py-3 font-medium">{c.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.centre_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatSlot(c)}</td>
                    <td className="px-4 py-3">
                      {/* One instructor per class. Choosing "Unassigned" removes the instructor. */}
                      <select
                        aria-label={`Instructor for ${c.name}`}
                        value={c.instructor_id || ''}
                        onChange={(e) => assign(c, e.target.value)}
                        className={`${inputClass} max-w-[14rem]`}
                      >
                        <option value="">Unassigned</option>
                        {instructors.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <IconButton label={`Edit ${c.name}`} onClick={() => openEdit(c)}>
                          <PencilIcon size={18} />
                        </IconButton>
                        <IconButton label={`Remove ${c.name}`} tone="danger" onClick={() => remove(c)}>
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
        <Modal labelledBy="class-form-title" onClose={() => setForm(null)}>
          <form onSubmit={save} className="space-y-4">
            <h2 id="class-form-title" className="text-lg font-semibold">
              {form.id ? 'Edit class' : 'New class'}
            </h2>
            <Field label="Class name">
              <input required maxLength={150} value={form.name} onChange={setField('name')} className={inputClass} data-autofocus />
            </Field>
            <Field label="Centre">
              <select required value={form.centre_id} onChange={setField('centre_id')} className={inputClass}>
                <option value="" disabled>
                  Choose a centre
                </option>
                {centres
                  .filter((c) => c.is_active || c.id === form.centre_id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Day">
              <select value={form.weekday} onChange={setField('weekday')} className={inputClass}>
                {WEEKDAYS.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start time">
                <input required type="time" value={form.start} onChange={setField('start')} className={inputClass} />
              </Field>
              <Field label="End time">
                <input required type="time" value={form.end} onChange={setField('end')} className={inputClass} />
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
