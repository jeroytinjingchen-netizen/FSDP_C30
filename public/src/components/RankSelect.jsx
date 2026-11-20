// RankSelect.jsx - the "Rank" filter. A searchable dropdown that groups ranks into tiers and shows
// each rank's belt colour, so people can pick by tier or belt name instead of reading 23 kyu numbers.
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { CheckIcon, ChevronDownIcon, SearchIcon, XIcon } from './Icons.jsx';
import { cn, inputClass } from './ui.jsx';
import { beltTones, groupRanks, showColour, tierFor } from './rankOptions.js';
import { highlight, matchCount, matchesAll, terms } from './combobox.jsx';

// SCOPES are the quick tier chips in the panel header. Most people only need "Kyu" or "Dan", so they
// can cut 23 ranks down to 9 or 8 without typing.
const SCOPES = [
  { key: 'all', label: 'All' },
  { key: 'kyu', label: 'Kyu' },
  { key: 'dan', label: 'Dan' },
];

// searchText is everything a rank can be found by: its name, its belt colour and its tier label.
// That is what makes "3", "brown" and "senior" all narrow the list.
const searchText = (rank) => `${rank.name} ${rank.colour || ''} ${tierFor(rank).label}`.toLowerCase();

// BeltSwatch draws the belt as a small stripe. Two-tone belts such as Blue-Silver are split in half.
// With no colour it renders an empty spacer, so "All ranks" still lines up with the rows below it.
function BeltSwatch({ colour }) {
  if (!colour) return <span aria-hidden="true" className="h-4 w-3 shrink-0" />;

  const tones = beltTones(colour);
  const background =
    tones.length > 1
      ? `linear-gradient(90deg, ${tones[0]} 0 50%, ${tones[1]} 50% 100%)`
      : tones[0];

  return (
    <span
      aria-hidden="true"
      className="h-4 w-3 shrink-0 rounded-[3px] ring-1 ring-black/25 ring-inset"
      style={{ background }}
    />
  );
}

// label is the visible caption above the trigger. Pass null where the surrounding filters have no
// captions (the Students page), and the trigger falls back to an aria-label instead.
export default function RankSelect({ ranks = [], value, onChange, label = 'Rank', className }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('all');
  const [active, setActive] = useState(0);

  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const searchRef = useRef(null);
  const optionRefs = useRef([]);

  const idBase = useId().replace(/:/g, '');
  const labelId = `rank-label-${idBase}`;
  const listId = `rank-list-${idBase}`;

  const selected = ranks.find((rank) => String(rank.id) === String(value)) || null;
  const isSelected = (option) => String(option.id) === String(value ?? '');

  // groups drives the panel: an optional "All ranks" row, then Junior Kyu / Senior Kyu / Dan.
  // options is the same ranks flattened, so the active index matches arrow-key movement.
  const { groups, options, words, shown, scoped, partial } = useMemo(() => {
    const words = terms(query);
    const inScope = (rank) =>
      scope === 'all' || (scope === 'dan' ? tierFor(rank).key === 'dan' : tierFor(rank).key !== 'dan');

    const scoped = ranks.filter(inScope);
    let matched = scoped.filter((rank) => matchesAll(searchText(rank), words));
    let partial = false;

    // Fall back to the ranks matching the most words, so a stray word such as "brown gold belt"
    // still shows the Brown-Gold rank instead of an empty list.
    if (words.length && !matched.length) {
      const scored = scoped
        .map((rank) => ({ rank, score: matchCount(searchText(rank), words) }))
        .filter((entry) => entry.score > 0);
      if (scored.length) {
        const best = Math.max(...scored.map((entry) => entry.score));
        matched = scored.filter((entry) => entry.score === best).map((entry) => entry.rank);
        partial = true;
      }
    }

    // Stay in rank_order even while searching, so the tiers always read Junior Kyu -> Senior Kyu -> Dan
    // and a search never scrambles the order people just learned.
    const sorted = [...matched].sort((a, b) => Number(a.rank_order) - Number(b.rank_order));

    // "All ranks" stays reachable from any tier chip, but drops out when the search cannot match it.
    const showAll = !words.length || matchesAll('all ranks', words);
    const groups = groupRanks(sorted, { includeAll: showAll });
    const options = groups.flatMap((group) => group.options);

    return { groups, options, words, shown: sorted.length, scoped: scoped.length, partial };
  }, [ranks, query, scope]);

  const activeIndex = options.length ? Math.min(active, options.length - 1) : -1;

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
    optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  function openPanel() {
    setQuery('');
    setScope('all');
    const at = options.findIndex(isSelected);
    setActive(at === -1 ? 0 : at);
    setOpen(true);
  }

  function close({ focusTrigger = false } = {}) {
    setOpen(false);
    setQuery('');
    setScope('all');
    setActive(0);
    if (focusTrigger) triggerRef.current?.focus();
  }

  function choose(option) {
    close({ focusTrigger: true });
    onChange(option.id === '' ? '' : String(option.id));
  }

  function chooseScope(next) {
    setScope(next);
    setQuery('');
    setActive(0);
    searchRef.current?.focus();
  }

  // Keys are handled on the whole panel, so they work whether focus is in the search box or on a chip.
  function onPanelKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close({ focusTrigger: true });
    } else if (e.key === 'Tab') {
      close();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!options.length) return;
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (Math.min(i, options.length - 1) + step + options.length) % options.length);
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      if (options.length) setActive(e.key === 'Home' ? 0 : options.length - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (options[activeIndex]) choose(options[activeIndex]);
    }
  }

  return (
    <div className={cn('flex flex-col gap-1.5 text-sm', className)}>
      {label && (
        <span id={labelId} className="font-medium text-muted-foreground">
          {label}
        </span>
      )}

      <div ref={rootRef} className="relative">
        <button
          ref={triggerRef}
          type="button"
          aria-labelledby={label ? labelId : undefined}
          aria-label={label ? undefined : 'Filter by rank'}
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
          className={cn(inputClass, 'flex items-center gap-2 text-left', selected ? 'pr-14' : 'pr-3')}
        >
          <BeltSwatch colour={selected?.colour} />
          <span className="min-w-0 flex-1 truncate">
            {selected ? (
              <>
                {selected.name}
                {showColour(selected) && (
                  <span className="text-muted-foreground"> · {selected.colour}</span>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">All ranks</span>
            )}
          </span>
          <ChevronDownIcon
            size={16}
            className={cn(
              'shrink-0 text-muted-foreground transition-transform duration-200',
              open && 'rotate-180'
            )}
          />
        </button>

        {selected && (
          <button
            type="button"
            aria-label="Clear rank filter"
            onClick={() => {
              onChange('');
              triggerRef.current?.focus();
            }}
            className="absolute right-9 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground transition-colors duration-150 hover:text-foreground"
          >
            <XIcon size={14} />
          </button>
        )}

        {open && (
          <div
            onKeyDown={onPanelKeyDown}
            className="animate-fade-in absolute left-0 z-50 mt-1.5 w-full overflow-hidden rounded-xl border bg-card shadow-xl sm:min-w-[21rem]"
          >
            <div className="relative p-2">
              <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground">
                <SearchIcon size={16} />
              </span>
              <input
                ref={searchRef}
                type="text"
                role="combobox"
                aria-label="Search ranks"
                aria-autocomplete="list"
                aria-haspopup="listbox"
                aria-expanded="true"
                aria-controls={listId}
                aria-activedescendant={activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined}
                autoComplete="off"
                spellCheck={false}
                placeholder="Search ranks or belts"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
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

            <div role="group" aria-label="Rank tier" className="flex gap-1.5 px-2 pb-2">
              {SCOPES.map((entry) => (
                <button
                  key={entry.key}
                  type="button"
                  aria-pressed={scope === entry.key}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => chooseScope(entry.key)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-150',
                    scope === entry.key
                      ? 'border-transparent bg-accent-soft text-accent-text'
                      : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  {entry.label}
                </button>
              ))}
            </div>

            {options.length > 0 ? (
              <ul
                id={listId}
                role="listbox"
                aria-label="Ranks"
                className="max-h-72 overflow-y-auto overscroll-contain pb-1.5"
              >
                {groups.map((group) => {
                  const headerId = `${listId}-${group.key}`;
                  return (
                    <li
                      key={group.key}
                      role="group"
                      aria-labelledby={group.label ? headerId : undefined}
                      className={group.label ? 'pb-1' : undefined}
                    >
                      {group.label && (
                        <div
                          id={headerId}
                          className="sticky top-0 z-10 flex items-baseline justify-between gap-2 border-b bg-card px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                        >
                          <span>{group.label}</span>
                          <span className="font-normal normal-case tracking-normal">{group.hint}</span>
                        </div>
                      )}
                      {group.options.map((option) => {
                        const index = options.indexOf(option);
                        const chosen = isSelected(option);
                        return (
                          <div
                            key={option.id || 'all'}
                            id={`${listId}-option-${index}`}
                            ref={(el) => {
                              optionRefs.current[index] = el;
                            }}
                            role="option"
                            aria-selected={chosen}
                            onMouseEnter={() => setActive(index)}
                            onClick={() => choose(option)}
                            className={cn(
                              'mx-1.5 mt-1 flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors duration-150',
                              index === activeIndex ? 'bg-muted text-foreground' : 'text-foreground'
                            )}
                          >
                            <BeltSwatch colour={option.colour} />
                            <span className="min-w-0 flex-1 truncate">
                              {highlight(option.name, words)}
                              {showColour(option) && (
                                <span className="text-muted-foreground">
                                  {' · '}
                                  {highlight(option.colour, words)}
                                </span>
                              )}
                            </span>
                            {chosen && <CheckIcon size={16} className="shrink-0 text-accent-text" />}
                          </div>
                        );
                      })}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">No ranks match “{query}”.</p>
            )}

            <div className="flex items-center justify-between gap-3 border-t px-3 py-2 text-xs text-muted-foreground">
              <span className="shrink-0">
                {words.length
                  ? `${partial ? 'Closest matches · ' : ''}${shown} of ${scoped} ranks`
                  : `${scoped} ranks`}
              </span>
              <span className="hidden min-w-0 truncate sm:inline">↑↓ to move · Enter to select</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}