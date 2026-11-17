// services/availability.js - is an instructor free to teach at a given time? (AS-12)
//
// Availability is stored as weekly slots: weekday (0 = Monday ... 6 = Sunday) and minutes since
// midnight in Singapore time. Sessions are stored as timestamps, so we convert them to Singapore
// weekday and minute before comparing.
const SG_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function toSingapore(value) {
  const shifted = new Date(new Date(value).getTime() + SG_OFFSET_MS);
  return {
    day: Math.floor(shifted.getTime() / DAY_MS),
    weekday: (shifted.getUTCDay() + 6) % 7, // JS: 0 = Sunday  ->  ours: 0 = Monday
    minute: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

// Joins slots that touch or overlap, so a class across two back-to-back slots still fits.
function mergeSlots(slots) {
  const sorted = slots
    .map((s) => ({ weekday: Number(s.weekday), start: Number(s.start_minute), end: Number(s.end_minute) }))
    .sort((a, b) => a.weekday - b.weekday || a.start - b.start);
  const merged = [];
  for (const s of sorted) {
    const last = merged[merged.length - 1];
    if (last && last.weekday === s.weekday && s.start <= last.end) last.end = Math.max(last.end, s.end);
    else merged.push({ ...s });
  }
  return merged;
}

// True when the whole class (startsAt to endsAt) sits inside one of the instructor's slots.
function isCovered(slots, startsAt, endsAt) {
  const from = toSingapore(startsAt);
  const to = toSingapore(endsAt);
  if (from.day !== to.day) return false; // a class that runs past midnight is not covered
  return mergeSlots(slots).some((s) => s.weekday === from.weekday && s.start <= from.minute && s.end >= to.minute);
}

// Returns the instructors who are NOT available for one dated session.
// An instructor with no saved slots is not restricted.
async function findUnavailable(instructorIds, startsAt, endsAt, Instructor) {
  const unavailable = [];
  for (const id of instructorIds) {
    const slots = await Instructor.listAvailability(id);
    if (!slots || slots.length === 0) continue;
    if (!isCovered(slots, startsAt, endsAt)) {
      const instructor = await Instructor.findById(id);
      unavailable.push({ instructor_id: id, name: instructor ? instructor.name : id });
    }
  }
  return unavailable;
}

// True when a weekly class (weekday, start_minute, end_minute) sits inside one of the instructor's slots.
function isTemplateCovered(slots, weekday, startMinute, endMinute) {
  return mergeSlots(slots).some((s) => s.weekday === Number(weekday) && s.start <= startMinute && s.end >= endMinute);
}

// Same check for a class template, which already has a weekday and minutes (no time-zone conversion needed).
async function findUnavailableForTemplate(instructorIds, weekday, startMinute, endMinute, Instructor) {
  const unavailable = [];
  for (const id of instructorIds) {
    const slots = await Instructor.listAvailability(id);
    if (!slots || slots.length === 0) continue; // no saved slots = not restricted
    if (!isTemplateCovered(slots, weekday, startMinute, endMinute)) {
      const instructor = await Instructor.findById(id);
      unavailable.push({ instructor_id: id, name: instructor ? instructor.name : id });
    }
  }
  return unavailable;
}

module.exports = { toSingapore, mergeSlots, isCovered, findUnavailable, isTemplateCovered, findUnavailableForTemplate };