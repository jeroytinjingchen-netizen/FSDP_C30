// format.js - small helpers that turn raw API values into text for the screen.

// Weekday numbers from the API: 0 = Monday ... 6 = Sunday.
export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Minutes after midnight -> "10:30am". Math.floor drops the fraction; % is the remainder.
// padStart(2, '0') pads a number to two digits (5 -> "05").
export function formatMinute(minute) {
  const h24 = Math.floor(minute / 60);
  const m = String(minute % 60).padStart(2, '0');
  const suffix = h24 >= 12 ? 'pm' : 'am';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m}${suffix}`;
}

// A class slot, e.g. "Saturday 10:00am - 11:00am".
export function formatSlot(c) {
  return `${WEEKDAYS[c.weekday]} ${formatMinute(c.start_minute)} - ${formatMinute(c.end_minute)}`;
}

// "HH:MM" from an <input type="time"> -> minutes after midnight, and back.
export function timeToMinute(text) {
  const [h, m] = text.split(':').map(Number);
  return h * 60 + m;
}
export function minuteToTime(minute) {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}

// Cents (integer) -> "$12.50". Intl.NumberFormat formats numbers for a locale and currency.
const money = new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD' });
export const formatMoney = (cents) => money.format((cents || 0) / 100);

// An ISO timestamp -> "5 Jun 2026, 3:04 pm" in Singapore time. Returns "-" when empty.
export function formatDateTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('en-SG', {
    timeZone: 'Asia/Singapore', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

// An ISO timestamp -> "5 Jun 2026" in Singapore time.
export function formatDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('en-SG', {
    timeZone: 'Asia/Singapore', day: 'numeric', month: 'short', year: 'numeric',
  });
}
