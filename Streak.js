import { jakartaToday } from "@/lib/portal";

// A Zoom day counts as attended when the mentor marked the student present.
export const ATTENDED_STATUSES = ["confirmed", "partial", "late"];

const dayOf = (row) => String(row?.date || "").slice(0, 10);
const clean = (value) => String(value || "").trim();

// Streak rules (Snapchat style, one day = one point):
// • a day only exists when the member really acted: mentor-verified presence,
//   a seat they reserved, or the Zoom link they opened → +1
// • just opening the portal never counts and never breaks anything
// • several classes on the same day                 → still +1
// • a day without any class                         → ignored, never breaks
// • a class day that was missed                     → streak ends
// • today's class is still open, so it never breaks the streak before it happens
export function buildStreak({
  attendance = [],
  reservations = [],
  clicks = [],
  sessions = [],
  today = jakartaToday(),
  memberSince = "",
}) {
  const since = clean(memberSince).slice(0, 10);
  const days = new Map();
  const entryOf = (date) => {
    if (!days.has(date)) days.set(date, { date, marked: "", clicked: false, reserved: false, mentor: "", level: "" });
    return days.get(date);
  };

  attendance.forEach((row) => {
    const date = dayOf(row);
    if (!date) return;
    const entry = entryOf(date);
    entry.marked = clean(row?.status) || entry.marked;
    entry.mentor = entry.mentor || clean(row?.mentor_name);
    entry.level = entry.level || clean(row?.level);
  });

  // Opening the Zoom link is an action, so it counts on its own.
  clicks.forEach((row) => {
    const date = dayOf(row);
    if (!date) return;
    const entry = entryOf(date);
    entry.clicked = true;
    entry.mentor = entry.mentor || clean(row?.mentor_name);
    entry.level = entry.level || clean(row?.level);
  });

  reservations.forEach((row) => {
    const date = dayOf(row);
    if (!date || clean(row?.status) === "cancelled") return;
    const entry = entryOf(date);
    entry.reserved = true;
    entry.mentor = entry.mentor || clean(row?.mentor_name);
    entry.level = entry.level || clean(row?.level);
  });

  // Days that really had a class, plus every day the member acted on.
  const classDays = new Set(days.keys());
  sessions.forEach((row) => {
    const date = dayOf(row);
    if (!date || row?.is_off) return;
    if (!(row?.published_levels || []).length) return;
    classDays.add(date);
  });
  if (since) [...classDays].forEach((date) => { if (date < since) classDays.delete(date); });

  const stateOf = (date) => {
    const entry = days.get(date);
    const marked = entry?.marked || "";
    if (ATTENDED_STATUSES.includes(marked)) return "attended";
    if (marked === "absent") return "missed";
    if (marked === "excused") return "excused";
    if (entry && (entry.clicked || entry.reserved)) return "joined";
    if (date < today) return "missed";
    return "open";
  };

  const ordered = [...classDays].sort();
  const past = ordered.filter((date) => date <= today);
  const done = (date) => ["attended", "joined"].includes(stateOf(date));

  let current = 0;
  for (let index = past.length - 1; index >= 0; index -= 1) {
    const date = past[index];
    if (done(date)) {
      current += 1;
      continue;
    }
    if (date === today) continue;
    if (stateOf(date) === "excused") continue;
    break;
  }

  let best = 0;
  let run = 0;
  past.forEach((date) => {
    if (done(date)) {
      run += 1;
      best = Math.max(best, run);
      return;
    }
    if (date !== today && stateOf(date) !== "excused") run = 0;
  });

  const todayState = classDays.has(today) || days.has(today) ? stateOf(today) : "off";
  const todayDone = todayState === "attended" || todayState === "joined";
  const total = past.filter((date) => done(date)).length;

  return {
    current,
    best: Math.max(best, current),
    total,
    todayState,
    todayDone,
    atRisk: todayState === "open",
    week: weekOf(today, stateOf, classDays),
    next: ordered.find((date) => date > today) || null,
  };
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const dayBefore = (iso, days) => {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

// The last seven calendar days, so the card can show reality:
// attended, reserved/joined, the class that is open today, or a day off.
function weekOf(today, stateOf, classDays) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = dayBefore(today, index - 6);
    const state = classDays.has(date) ? stateOf(date) : "off";
    // A reserved day burns exactly like a verified one, so the strip keeps its old look.
    const shown = state === "joined" ? "attended" : state;
    return {
      date,
      state: ["attended", "missed", "open"].includes(shown) ? shown : "off",
      day: WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()],
    };
  });
}