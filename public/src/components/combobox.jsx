// combobox.jsx - search helpers shared by the searchable dropdowns (CentreSwitcher, RankSelect).

// terms splits what the user typed into lowercase words, so "smu dojo" matches "SMU Dojo".
export const terms = (query) => query.toLowerCase().split(/\s+/).filter(Boolean);

// matchesAll is true when every word appears somewhere in the text.
export const matchesAll = (text, words) => words.every((word) => text.includes(word));

// matchCount is how many of the words appear in the text.
export const matchCount = (text, words) => words.filter((word) => text.includes(word)).length;


// highlight splits text into plain strings and <mark> spans around every matched word.
export function highlight(text, words) {
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
