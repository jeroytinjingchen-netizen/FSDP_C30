// utils/csv.js - small helpers shared by controllers that filter by date or export CSV files.

// Quotes one CSV cell and neutralises spreadsheet formula injection.
// A value that starts with = + - @ (or a tab/carriage return) would run as a formula in Excel,
// so a single quote is put in front of it. Double quotes inside the text are doubled, as CSV requires.
function csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

// Turns two YYYY-MM-DD strings into Date bounds in Singapore time (UTC+8).
// "start" is the beginning of the "from" day. "end" is the beginning of the day AFTER "to",
// so a query can use "< end" and include the whole last day.
function toBounds({ from, to }) {
  const start = new Date(`${from}T00:00:00+08:00`);
  const end = new Date(`${to}T00:00:00+08:00`);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

// Parses CSV text into an array of rows, each row an array of cell strings.
// Handles quoted cells, commas and line breaks inside quotes, "" as an escaped quote,
// Windows (CRLF) or Unix (LF) line endings, and a leading byte-order mark from Excel.
// It reads the text one character at a time and tracks whether it is inside quotes.
function parseCsv(text) {
  const src = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }   // escaped quote
      else if (ch === '"') inQuotes = false;                          // closing quote
      else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;                    // treat CRLF as one break
      row.push(cell); cell = '';
      rows.push(row); row = [];
    } else cell += ch;
  }
  // Last row when the file does not end with a line break.
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  // Drop completely blank lines.
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

module.exports = { csvCell, toBounds, parseCsv };
