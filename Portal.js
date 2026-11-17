export const LOGO_URL = "https://media.base44.com/images/public/user_6a15ddf7bc13d367b171401a/e9b0939fd_TemanEnglish_20260115_075335_00001.jpg";

// Official Lynk.id checkout used to extend a membership.
export const EXTEND_URL = "https://lynk.id/fajarandikq/78j6zn4vom0e";

export const LEVEL_LABEL = { beginner: "Beginner", intermediate: "Intermediate" };

// Every room carries its level in front of its name. The owner can replace the
// whole label from the portal; leaving it empty keeps the automatic one.
export const roomDisplayName = (room = {}) => {
  const custom = String(room.room_name || "").trim();
  if (custom) return custom;
  return `${LEVEL_LABEL[room.level] || "Beginner"} - ${room.mentor_name || "Mentor"}`;
};

// Support inbox shown on the profile's help card.
export const SUPPORT_EMAIL = "fajarandika233@gmail.com";

export const STATUS_LABEL = {
  pending: "Pending",
  active: "Active",
  expired: "Expired",
  suspended: "Suspended",
};

export const ROLE_LABEL = { owner: "Owner", mentor: "Mentor", student: "Student" };

export const ATTENDANCE_LABEL = {
  confirmed: "Present",
  partial: "Half session",
  late: "Late",
  absent: "Absent",
  excused: "Excused",
  unverified: "Not marked",
};

export const EARNING_LABEL = {
  pending: "Pending review",
  approved: "Approved",
  paid: "Paid",
  disputed: "Disputed",
  cancelled: "Cancelled",
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function jakartaToday() {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

// Hours 0-23 on the Jakarta clock, used by the 22:00 topic switch.
export function jakartaHour(at = Date.now()) {
  return new Date(at + 7 * 3600 * 1000).getUTCHours();
}

// Age in whole years from a stored birthday, or null when it is not set.
export function ageFromBirthDate(birthDate) {
  if (!birthDate) return null;
  const birth = Date.parse(`${String(birthDate).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(birth)) return null;
  const today = Date.parse(`${jakartaToday()}T00:00:00Z`);
  const years = Math.floor((today - birth) / 31557600000);
  return years >= 5 && years <= 100 ? years : null;
}

// Which day's topic the home screen should show.
// Before 22:00 it is today's topic; from 22:00 it switches to the next published
// topic, so the moment the clock passes midnight the "today" topic is already on
// screen. Weekends and empty days are skipped by looking at real material dates.
export function pickTopicDate(byDate = {}, today, at = Date.now()) {
  const dates = Object.keys(byDate || {})
    .filter((day) => (byDate[day] || []).length)
    .sort();
  if (!dates.length) return today;
  const next = dates.find((day) => day > today);
  if (jakartaHour(at) >= 22 && next) return next;
  if ((byDate[today] || []).length) return today;
  return dates.find((day) => day >= today) || today;
}

export function shiftDate(dateStr, days) {
  const base = Date.parse(dateStr + "T00:00:00Z") + days * 86400000;
  return new Date(base).toISOString().slice(0, 10);
}

export function isWeekend(dateStr) {
  const dow = new Date(dateStr + "T00:00:00Z").getUTCDay();
  return dow === 0 || dow === 6;
}

// Every room runs for two hours counted from its own start time. The Zoom link
// unlocks 30 minutes before that start, the class ends two hours later, and the
// finished room stays visible for one more hour before it is removed.
export const UNLOCK_MINUTES_BEFORE = 30;
export const CLASS_DURATION_MINUTES = 120;
export const ROOM_LINGER_MINUTES = 60;

export function clockFromStart(classTime, offsetMinutes) {
  const [h, m] = String(classTime || "20:00").split(":").map(Number);
  const total = (((h * 60 + m + offsetMinutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function classWindowFor(dateStr, classTime = "20:00") {
  const parsed = Date.parse(`${dateStr}T${String(classTime || "20:00")}:00+07:00`);
  const start = Number.isNaN(parsed) ? Date.now() : parsed;
  return {
    start,
    unlock: start - UNLOCK_MINUTES_BEFORE * 60000,
    end: start + CLASS_DURATION_MINUTES * 60000,
    hide: start + (CLASS_DURATION_MINUTES + ROOM_LINGER_MINUTES) * 60000,
  };
}

export function classPhase(dateStr, classTime, at = Date.now()) {
  const { unlock, end } = classWindowFor(dateStr, classTime);
  if (at < unlock) return "upcoming";
  if (at < end) return "open";
  return "closed";
}

// Per-room state: upcoming → ready (Zoom open) → live → finished ("Zoom selesai")
// → gone (removed an hour after the class ended).
export function roomPhase(dateStr, startTime, at = Date.now()) {
  const { start, unlock, end, hide } = classWindowFor(dateStr, startTime);
  if (at >= hide) return "gone";
  if (at >= end) return "finished";
  if (at >= start) return "live";
  if (at >= unlock) return "ready";
  return "upcoming";
}

export const unlockClock = (classTime = "20:00") => clockFromStart(classTime, -UNLOCK_MINUTES_BEFORE);
export const closeClock = (classTime = "20:00") => clockFromStart(classTime, CLASS_DURATION_MINUTES);

export function prettyDate(dateStr, withDay = true) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00Z");
  const label = `${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  return withDay ? `${DAY_NAMES[d.getUTCDay()]}, ${label}` : label;
}

export function shortDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00Z");
  return `${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()].slice(0, 3)}`;
}

export function clockTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const hh = String((d.getUTCHours() + 7) % 24).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function remaining(untilIso) {
  const ms = new Date(untilIso).getTime() - Date.now();
  if (ms <= 0) return null;
  const totalMinutes = Math.ceil(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// Days left in a membership period, counted from the stored end date.
export function daysLeft(endDate) {
  if (!endDate) return null;
  const end = Date.parse(String(endDate).slice(0, 10) + "T00:00:00Z");
  if (Number.isNaN(end)) return null;
  const today = Date.parse(jakartaToday() + "T00:00:00Z");
  return Math.round((end - today) / 86400000);
}

export function money(value) {
  return "Rp" + new Intl.NumberFormat("id-ID").format(Number(value) || 0);
}

export function greeting() {
  const hour = (new Date().getUTCHours() + 7) % 24;
  if (hour < 11) return "Good morning";
  if (hour < 15) return "Good afternoon";
  if (hour < 19) return "Good evening";
  return "Good night";
}

export function classDaysOfMonth(year, month) {
  const out = [];
  const cursor = new Date(Date.UTC(year, month, 1));
  while (cursor.getUTCMonth() === month) {
    const dow = cursor.getUTCDay();
    if (dow !== 0 && dow !== 6) out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}