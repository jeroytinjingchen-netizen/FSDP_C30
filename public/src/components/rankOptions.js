// rankOptions.js - belt colours and Kyu/Dan tiers shared by the rank pickers.
// Ranks arrive from /api/lookups/ranks already sorted lowest first (rank_order).

// BELT_COLOURS maps a ranks.colour value to the stripe colour shown on the swatch.
// Two-tone belts (for example Blue-Silver) list both halves so the swatch can split.
const BELT_COLOURS = {
  Red: ['#dc2626'],
  'Red-Gold': ['#dc2626', '#eab308'],
  Yellow: ['#facc15'],
  Orange: ['#f97316'],
  Green: ['#16a34a'],
  Purple: ['#7c3aed'],
  Blue: ['#2563eb'],
  'Blue-Silver': ['#2563eb', '#cbd5e1'],
  'Blue-Gold': ['#2563eb', '#eab308'],
  Brown: ['#78350f'],
  'Brown-Silver': ['#78350f', '#cbd5e1'],
  'Brown-Gold': ['#78350f', '#eab308'],
  Black: ['#111827'],
  'Black-Silver': ['#111827', '#cbd5e1'],
  'Black-Gold': ['#111827', '#eab308'],
};

// A colour the database knows but this file does not still gets a neutral swatch.
const UNKNOWN_COLOUR = ['#64748b'];

export const beltTones = (colour) => BELT_COLOURS[colour] || UNKNOWN_COLOUR;

// RANK_TIERS groups the 23 ranks into three scannable blocks, split by rank_order.
// "through" is the highest rank_order that still belongs to that tier.
export const RANK_TIERS = [
  { key: 'junior', label: 'Junior Kyu', hint: '12th to 7th', through: 6 },
  { key: 'senior', label: 'Senior Kyu', hint: '6th to 1st', through: 15 },
  { key: 'dan', label: 'Dan', hint: 'Junior Dan and above', through: Number.POSITIVE_INFINITY },
];

export function tierFor(rank) {
  const order = Number(rank.rank_order);
  return RANK_TIERS.find((tier) => order <= tier.through) || RANK_TIERS[RANK_TIERS.length - 1];
}

// showColour hides the redundant " · Blue-Silver" suffix when the rank name already says it,
// so transitional ranks read as "Blue-Silver" instead of "Blue-Silver · Blue-Silver".
export const showColour = (rank) =>
  Boolean(rank?.colour) && !String(rank?.name || '').toLowerCase().includes(String(rank.colour).toLowerCase());
// groupRanks turns rank rows into display groups: an optional "All ranks" row, then Junior Kyu,
// Senior Kyu and Dan. Ranks keep the order they arrive in, so the list still reads lowest to highest.
export function groupRanks(ranks = [], { includeAll = true, allLabel = 'All ranks' } = {}) {
  const groups = [];
  if (includeAll) {
    groups.push({
      key: 'all',
      label: null,
      hint: '',
      options: [{ id: '', name: allLabel, colour: null, group: null }],
    });
  }

  for (const rank of ranks) {
    const tier = tierFor(rank);
    let group = groups.find((entry) => entry.key === tier.key);
    if (!group) {
      group = { key: tier.key, label: tier.label, hint: tier.hint, options: [] };
      groups.push(group);
    }
    group.options.push({ id: rank.id, name: rank.name, colour: rank.colour, group: tier.label });
  }

  return groups;
}
