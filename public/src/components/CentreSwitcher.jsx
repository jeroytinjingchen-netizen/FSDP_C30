import { useCentre } from '../CentreContext.jsx';
import { inputClass } from './ui.jsx';

export default function CentreSwitcher() {
  const { centres, centreId, setCentreId } = useCentre();

  return (
    <select
      id="centre-switcher"
      value={centreId || ''}
      onChange={(e) => setCentreId(e.target.value || null)}
      className={inputClass}
    >
      <option value="">All centres</option>
      {centres
        .filter((c) => c.is_active)
        .map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
    </select>
  );
}
