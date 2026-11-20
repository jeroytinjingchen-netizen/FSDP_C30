// CentreSwitcher.jsx - the "All centres" filter.
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useCentre } from '../CentreContext.jsx';
import { CheckIcon, ChevronDownIcon, SearchIcon, XIcon } from './Icons.jsx';
import { cn, inputClass } from './ui.jsx';

// ALL_CENTRES is the "no filter" option. Its id is null, which CentreContext reads as "All centres".
const ALL_CENTRES = { id: null, name: 'All centres' };

// terms splits what the user typed into lowercase words, so "smu dojo" matches "SMU Dojo".
const terms = (query) => query.toLowerCase().split(/\s+/).filter(Boolean);

// matchesAll is true when every word appears somewhere in the text.
const matchesAll = (text, words) => words.every((word) => text.includes(word));

// matchCount is how many of the words appear in the text.
const matchCount = (text, words) => words.filter((word) => text.includes(word)).length;

// rank sorts better matches first: a name starting with the query, then a later word, then a partial word.
function rank(name, words) {
  if (!words.length) return 0;
  const lower = name.toLowerCase();
  if (lower.startsWith(words[0])) return 0;
  if (lower.split(/[\s-]+/).some((word) => word.startsWith(words[0]))) return 1;
  return 2;
}

// highlight splits text into plain strings and <mark> spans around every matched word.
function highlight(text, words) {
  if (!words.length) return text;
  const lower = text.toLowerCase();

  // Collect the [start, end) position of every word occurrence, then merge the ones that overlap.
  const ranges = [];
  for (const word of words) {
    for (let at = lower.indexOf(word); at !== -1; at = lower.indexOf(word, at + word.length)) {
      ranges.push([at, at + word.length]);
    }
  }
  if (!ranges.length) return text;
  ranges.sort((a, b) => a[0] - b[0] || b[1] - a[1]);

  const merged = [];
  for (const [start, end] of ranges) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }

  // Rebuild the text, marking each merged range.
  const parts = [];
  let cursor = 0;
  merged.forEach(([start, end], i) => {
    if (start > cursor) parts.push(text.slice(cursor, start));
    parts.push(
      <mark key={i} className="rounded-sm bg-accent-soft px-0.5 font-semibold text-accent-text">
        {text.slice(start, end)}
      </mark>
    );
    cursor = end;
  });
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

// CentreSwitcher: a searchable dropdown that filters admin pages by centre. The selection lives in
// CentreContext, so every page that calls useCentre() sees it. Only active centres are listed.
export default function CentreSwitcher() {
  const { centres, centreId, setCentreId } = useCentre();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const searchRef = useRef(null);
  const optionRefs = useRef([]);

  const listId = `centre-list${useId().replace(/:/g, '')}`;

  const activeCentres = useMemo(() => centres.filter((c) => c.is_active), [centres]);
  const selected = activeCentres.find((c) => c.id === centreId) || centres.find((c) => c.id === centreId);

  // options: "All centres" (when it matches) followed by the centres that match every typed word.
  // When no centre matches every word, fall back to those matching the most words, so a stray
  // word such as "jurong dojo" still shows the Jurong centre instead of an empty list.
  const { options, words, partial } = useMemo(() => {
    const words = terms(query);
    let matched = activeCentres.filter((c) => matchesAll(c.name.toLowerCase(), words));
    let partial = false;

    if (words.length && !matched.length) {
      const scored = activeCentres
        .map((c) => ({ centre: c, score: matchCount(c.name.toLowerCase(), words) }))
        .filter((entry) => entry.score > 0);
      if (scored.length) {
        const best = Math.max(...scored.map((entry) => entry.score));
        matched = scored.filter((entry) => entry.score === best).map((entry) => entry.centre);
        partial = true;
      }
    }

    const sorted = matched.sort(
      (a, b) => rank(a.name, words) - rank(b.name, words) || a.name.localeCompare(b.name)
    );

    const list = [];
    if (!words.length || matchesAll(ALL_CENTRES.name.toLowerCase(), words)) list.push(ALL_CENTRES);
    return { options: list.concat(sorted.map((c) => ({ id: c.id, name: c.name }))), words, partial };
  }, [activeCentres, query]);

  // Close when the user clicks anywhere outside the dropdown.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      if (!rootRef.current?.contains(e.target)) close();
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  // Focus the search box when the panel opens, and keep the active option in view as the user moves.
  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    optionRefs.current[active]?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  function openPanel() {
    setQuery('');
    setActive(Math.max(0, options.findIndex((o) => o.id === centreId)));
    setOpen(true);
  }

  function close({ focusTrigger = false } = {}) {
    setOpen(false);
    setQuery('');
    setActive(0);
    if (focusTrigger) triggerRef.current?.focus();
  }

  function choose(option) {
    setCentreId(option.id);
    close({ focusTrigger: true });
  }

  function onSearchKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close({ focusTrigger: true });
    } else if (e.key === 'Tab') {
      close();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!options.length) return;
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (i + step + options.length) % options.length);
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      if (options.length) setActive(e.key === 'Home' ? 0 : options.length - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (options[active]) choose(options[active]);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        id="centre-switcher"
        type="button"
        aria-label="Filter by centre"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => (open ? close() : openPanel())}
        onKeyDown={(e) => {
          if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !open) {
            e.preventDefault();
            openPanel();
          }
        }}
        className={cn(inputClass, 'flex items-center justify-between gap-2 pr-3 text-left')}
      >
        <span className="min-w-0 flex-1 truncate">{selected?.name || ALL_CENTRES.name}</span>
        <ChevronDownIcon
          size={16}
          className={cn(
            'shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180'
          )}
        />
      </button>

      {open && (
        <div className="animate-fade-in absolute right-0 z-50 mt-1.5 w-full overflow-hidden rounded-xl border bg-card shadow-xl sm:min-w-[21rem]">
          <div className="relative p-2">
            <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground">
              <SearchIcon size={16} />
            </span>
            <input
              ref={searchRef}
              type="text"
              role="combobox"
              aria-label="Search centres"
              aria-autocomplete="list"
              aria-haspopup="listbox"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={options.length ? `${listId}-option-${active}` : undefined}
              autoComplete="off"
              spellCheck={false}
              placeholder="Search centres"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onSearchKeyDown}
              className="h-9 w-full rounded-lg bg-muted pl-9 pr-8 text-sm text-foreground placeholder:text-muted-foreground"
            />
            {query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setQuery('');
                  setActive(0);
                  searchRef.current?.focus();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
              >
                <XIcon size={14} />
              </button>
            )}
          </div>

          {options.length > 0 ? (
            <ul
              id={listId}
              role="listbox"
              aria-label="Centres"
              className="max-h-80 overflow-y-auto overscroll-contain p-1.5"
            >
              {options.map((option, index) => {
                const isSelected = option.id === centreId;
                return (
                  <li
                    key={option.id ?? 'all'}
                    id={`${listId}-option-${index}`}
                    ref={(el) => {
                      optionRefs.current[index] = el;
                    }}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => choose(option)}
                    className={cn(
                      'flex cursor-pointer items-start gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors duration-150',
                      index === active ? 'bg-muted text-foreground' : 'text-foreground'
                    )}
                  >
                    <span className="min-w-0 flex-1 break-words">{highlight(option.name, words)}</span>
                    {isSelected && <CheckIcon size={16} className="mt-0.5 shrink-0 text-accent-text" />}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">No centres match “{query}”.</p>
          )}

          <div className="flex items-center justify-between gap-3 border-t px-3 py-2 text-xs text-muted-foreground">
            <span className="shrink-0">
              {words.length
                ? `${partial ? 'Closest matches · ' : ''}${options.length} of ${activeCentres.length} centres`
                : `${activeCentres.length} centre${activeCentres.length === 1 ? '' : 's'}`}
            </span>
            <span className="hidden min-w-0 truncate sm:inline">↑↓ to move · Enter to select</span>
          </div>
        </div>
      )}
    </div>
  );
}
