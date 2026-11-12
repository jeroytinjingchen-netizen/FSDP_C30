import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { ArchiveIcon, CalendarIcon, PencilIcon, PlusIcon, RestoreIcon, XIcon } from '../components/Icons.jsx';
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

const EMPTY = { id: '', name: '', email: '', phone: '', rank_id: '', qualifications: '', centre_ids: [] };
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Minutes since midnight <-> "HH:MM" for time inputs
const toTime = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const toMinutes = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

export default function Instructors() {
  const [rows, setRows] = useState([]);
  const [centres, setCentres] = useState([]);
  const [ranks, setRanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [availFor, setAvailFor] = useState(null);
  const [slots, setSlots] = useState([]);
  const [confirm, setConfirm] = useState(null);
  const [alert, setAlert] = useState(null);

  const load = useCallback(async () => {
    const [list, centreList, rankList] = await Promise.all([
      api('/api/instructors'),
      api('/api/centres'),
      api('/api/lookups/ranks'),
    ]);
    setRows(list);
    setCentres(centreList.filter((c) => c.is_active));
    setRanks(rankList);
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
    const payload = { ...body, rank_id: body.rank_id || null };
    setForm(null);
    run(
      () =>
        api(id ? `/api/instructors/${id}` : '/api/instructors', {
          method: id ? 'PUT' : 'POST',
          body: JSON.stringify(payload),
        }),
      id ? 'Instructor updated.' : 'Instructor added.'
    );
  }

  const toggleCentre = (centreId) =>
    setForm((f) => ({
      ...f,
      centre_ids: f.centre_ids.includes(centreId)
        ? f.centre_ids.filter((c) => c !== centreId)
        : [...f.centre_ids, centreId],
    }));

  const openEdit = (i) =>
    setForm({
      id: i.id,
      name: i.name,
      email: i.email || '',
      phone: i.phone || '',
      rank_id: i.rank_id || '',
      qualifications: i.qualifications || '',
      centre_ids: i.centre_ids || [],
    });

  const openAvailability = async (i) => {
    try {
      const data = await api(`/api/instructors/${i.id}/availability`);
      setSlots(data.map((s) => ({ weekday: s.weekday, start: toTime(s.start_minute), end: toTime(s.end_minute) })));
      setAvailFor(i);
    } catch (err) {
      setAlert({ error: true, text: err.message });
    }
  };

  function saveAvailability(e) {
    e.preventDefault();
    const body = {
      slots: slots.map((s) => ({
        weekday: Number(s.weekday),
        start_minute: toMinutes(s.start),
        end_minute: toMinutes(s.end),
      })),
    };
    const name = availFor.name;
    setAvailFor(null);
    run(
      () => api(`/api/instructors/${availFor.id}/availability`, { method: 'PUT', body: JSON.stringify(body) }),
      `Availability saved for ${name}.`
    );
  }

  const updateSlot = (idx, key, value) =>
    setSlots((list) => list.map((s, i) => (i === idx ? { ...s, [key]: value } : s)));

  const toggleActive = (i) =>
    setConfirm({
      title: i.is_active ? 'Deactivate instructor?' : 'Activate instructor?',
      message: `${i.name} will be ${i.is_active ? 'hidden from new scheduling' : 'available for scheduling again'}.`,
      confirmLabel: i.is_active ? 'Deactivate' : 'Activate',
      danger: i.is_active,
      action: () =>
        run(
          () => api(`/api/instructors/${i.id}/${i.is_active ? 'deactivate' : 'activate'}`, { method: 'POST' }),
          i.is_active ? 'Instructor deactivated.' : 'Instructor activated.'
        ),
    });

  const centreName = (id) => centres.find((c) => c.id === id)?.name || 'Unknown';

  return (
    <>
      <PageHeader title="Instructors" description="Manage instructors, their centres and weekly availability.">
        <Button onClick={() => setForm({ ...EMPTY })} disabled={centres.length === 0}>
          <PlusIcon size={18} />
          New instructor
        </Button>
      </PageHeader>

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Instructors</caption>
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Name</th>
                <th scope="col" className="px-4 py-3 font-medium">Rank</th>
                <th scope="col" className="px-4 py-3 font-medium">Centres</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <SkeletonRows rows={4} cols={5} />}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <EmptyState icon={CalendarIcon} title="No instructors yet" hint="Add an instructor to assign classes." />
                  </td>
                </tr>
              )}
              {!loading &&
                rows.map((i) => (
                  <tr key={i.id} className="border-t transition-colors duration-200 hover:bg-muted/60">
                    <td className="px-4 py-3 font-medium">{i.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{i.rank_name || '-'}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {(i.centre_ids || []).map(centreName).join(', ') || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge active={i.is_active} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="secondary" onClick={() => openAvailability(i)}>
                          Availability
                        </Button>
                        <IconButton label={`Edit ${i.name}`} onClick={() => openEdit(i)}>
                          <PencilIcon size={18} />
                        </IconButton>
                        <IconButton
                          label={`${i.is_active ? 'Deactivate' : 'Activate'} ${i.name}`}
                          tone={i.is_active ? 'danger' : 'default'}
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
              {form.id ? 'Edit instructor' : 'New instructor'}
            </h2>
            <Field label="Name">
              <input required maxLength={150} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} data-autofocus />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Email">
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} />
              </Field>
              <Field label="Phone">
                <input maxLength={30} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputClass} />
              </Field>
            </div>
            <Field label="Rank">
              <select value={form.rank_id} onChange={(e) => setForm({ ...form, rank_id: e.target.value })} className={inputClass}>
                <option value="">No rank</option>
                {ranks.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Qualifications">
              <textarea rows={2} maxLength={500} value={form.qualifications} onChange={(e) => setForm({ ...form, qualifications: e.target.value })} className={inputClass} />
            </Field>
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium">Centres (select at least one)</legend>
              <div className="flex flex-wrap gap-3">
                {centres.map((c) => (
                  <label key={c.id} className="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.centre_ids.includes(c.id)} onChange={() => toggleCentre(c.id)} className="size-4 accent-[var(--accent)]" />
                    {c.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setForm(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.centre_ids.length === 0}>
                Save
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {availFor && (
        <Modal labelledBy="availability-title" onClose={() => setAvailFor(null)}>
          <form onSubmit={saveAvailability} className="space-y-4">
            <h2 id="availability-title" className="text-lg font-semibold">
              Availability: {availFor.name}
            </h2>
            <p className="text-sm text-muted-foreground">Times are Singapore time. Each slot must end after it starts.</p>
            {slots.length === 0 && <p className="text-sm text-muted-foreground">No slots yet.</p>}
            {slots.map((s, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2">
                <Field label="Day">
                  <select value={s.weekday} onChange={(e) => updateSlot(idx, 'weekday', e.target.value)} className={inputClass}>
                    {WEEKDAYS.map((d, n) => (
                      <option key={d} value={n}>
                        {d}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="From">
                  <input type="time" required value={s.start} onChange={(e) => updateSlot(idx, 'start', e.target.value)} className={inputClass} />
                </Field>
                <Field label="To">
                  <input type="time" required value={s.end} onChange={(e) => updateSlot(idx, 'end', e.target.value)} className={inputClass} />
                </Field>
                <IconButton label="Remove slot" tone="danger" onClick={() => setSlots((l) => l.filter((_, i) => i !== idx))}>
                  <XIcon size={18} />
                </IconButton>
              </div>
            ))}
            <Button variant="secondary" onClick={() => setSlots((l) => [...l, { weekday: 0, start: '09:00', end: '12:00' }])}>
              <PlusIcon size={18} />
              Add slot
            </Button>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setAvailFor(null)}>
                Cancel
              </Button>
              <Button type="submit">Save availability</Button>
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
