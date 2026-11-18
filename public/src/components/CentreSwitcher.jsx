// CentreSwitcher.jsx - the "All centres" dropdown.
import { useCentre } from '../CentreContext.jsx';
import { inputClass } from './ui.jsx';

// CentreSwitcher: a dropdown that filters admin pages by centre. The selection lives in CentreContext,
// so every page that calls useCentre() sees it. Only active centres are listed.
export default function CentreSwitcher() {
  const { centres, centreId, setCentreId } = useCentre();

  return (
    <select
      id="centre-switcher"
      aria-label="Filter by centre"
      value={centreId || ''}
      onChange={(e) => setCentreId(e.target.value || null)}
      className={`${inputClass} appearance-none bg-no-repeat bg-[length:1rem] bg-[right_0.75rem_center] pr-9`}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpath d='M6 8l4 4 4-4'/%3E%3C/svg%3E\")",
      }}
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
