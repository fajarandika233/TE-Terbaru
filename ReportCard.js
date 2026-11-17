import { STUDENT_CRITERIA } from "@/lib/feedbackCriteria";

// ---------------------------------------------------------------------------
// Report card engine.
// Everything here is computed from records the student already has on screen:
// mentor feedback (rating + 6 rubric scores + notes) and attendance history.
// No AI call, no credits.
// ---------------------------------------------------------------------------

export const SCORE_BANDS = [
  {
    min: 4.4,
    label: "Excellent",
    tone: "bg-[#E9F7EC] text-[#1B7A34]",
    meaning:
      "You speak with control and you keep the conversation going. Now the work is about sounding natural, not about being correct.",
  },
  {
    min: 3.6,
    label: "Strong",
    tone: "bg-[#EAF2FF] text-[#1D4ED8]",
    meaning:
      "You can carry a real conversation. The next jump comes from precision: word stress, richer phrases, and answering in longer turns.",
  },
  {
    min: 2.9,
    label: "Growing",
    tone: "bg-[#FFF6DF] text-[#8A6B00]",
    meaning:
      "You understand the class and you join in. You still stop to build sentences in your head, so the goal is more speaking time every session.",
  },
  {
    min: 2.1,
    label: "Building",
    tone: "bg-[#FFF1E6] text-[#B45309]",
    meaning:
      "The basics are appearing. Short, finished sentences said out loud are worth more right now than long, perfect ones you keep inside.",
  },
  {
    min: 0,
    label: "Starting",
    tone: "bg-[#F4F4F4] text-[#666]",
    meaning:
      "This is the starting line — everyone begins here. Your only job for now is to speak once more than last session.",
  },
];

// What each rubric score actually means, plus concrete English practice steps.
export const CRITERIA_GUIDE = {
  speaking: {
    meaning: "How much English you actually produce out loud during a session.",
    actions: [
      "Answer every mentor question with at least three full sentences.",
      "Say the sentence in English first, then ask for the missing word.",
      "Take one role-play or pair task in every class — volunteering counts.",
    ],
  },
  confidence: {
    meaning: "How willing you are to speak even when the sentence might come out wrong.",
    actions: [
      "Start with short sentences you can finish, then make them longer.",
      "Ask your mentor one question in English every session.",
      "Record a 30-second voice note daily and listen back once, calmly.",
    ],
  },
  pronunciation: {
    meaning: "How clearly your sounds and word stress reach the listener.",
    actions: [
      "Shadow one minute of audio a day: same speed, same rhythm, out loud.",
      "Mark the strong syllable on new words before you say them in class.",
      "Ask your mentor to correct two words you always pronounce the same way.",
    ],
  },
  vocabulary: {
    meaning: "The range of words and grammar you can reach for without stopping.",
    actions: [
      "Learn five new words a day and use each one in a sentence tonight.",
      "Keep a phrase notebook, not a word list — chunks are easier to reuse.",
      "Reuse yesterday's five words in the first five minutes of class.",
    ],
  },
  fluency: {
    meaning: "How smoothly you keep going instead of stopping to translate.",
    actions: [
      "Speak for 60 seconds on one topic daily without stopping.",
      "Use English fillers — 'well', 'let me think' — instead of silence.",
      "Repeat the same story three times; the third time is your real level.",
    ],
  },
  listening: {
    meaning: "How well you follow the question and answer to the point.",
    actions: [
      "Summarise the question back before you answer it.",
      "Ask one follow-up question in every conversation.",
      "Watch one short clip a day without subtitles, then retell it out loud.",
    ],
  },
};

const DAY = (row) => String(row.date || "").slice(0, 10);

const average = (list) =>
  list.length ? Math.round((list.reduce((sum, value) => sum + value, 0) / list.length) * 10) / 10 : 0;

const weekStart = (dateStr) => {
  const date = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return dateStr;
  const shift = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - shift);
  return date.toISOString().slice(0, 10);
};

export const bandFor = (score) => SCORE_BANDS.find((band) => score >= band.min) || SCORE_BANDS[SCORE_BANDS.length - 1];

export function buildReport(feedback = [], classes = []) {
  const rows = (feedback || [])
    .filter((row) => Number(row.rating) > 0)
    .slice()
    .sort((a, b) => DAY(a).localeCompare(DAY(b)));

  const overall = average(rows.map((row) => Number(row.rating) || 0));

  const criteria = STUDENT_CRITERIA.map((item) => {
    const values = rows.map((row) => Number(row[item.key]) || 0).filter((value) => value > 0);
    const half = Math.max(1, Math.min(3, Math.floor(values.length / 2)));
    const recent = values.slice(values.length - half);
    const older = values.slice(0, values.length - half);
    return {
      ...item,
      value: average(values),
      count: values.length,
      delta: values.length >= 3 && older.length ? Math.round((average(recent) - average(older)) * 10) / 10 : null,
    };
  });

  const scored = criteria.filter((item) => item.count > 0);
  const byValue = [...scored].sort((a, b) => b.value - a.value);
  const strongest = byValue[0] || null;
  const focus = [...byValue].reverse().slice(0, 2).filter((item) => item !== strongest || byValue.length === 1);

  const tagCounts = new Map();
  rows.forEach((row) => (row.tags || []).forEach((tag) => tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)));
  const tags = [...tagCounts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);

  const statuses = { confirmed: 0, partial: 0, late: 0, absent: 0, excused: 0, unverified: 0 };
  (classes || []).forEach((row) => {
    if (row.status in statuses) statuses[row.status] += 1;
  });
  const marked = Object.values(statuses).reduce((sum, value) => sum + value, 0);
  const attended = statuses.confirmed + statuses.partial + statuses.late;
  const countable = marked - statuses.excused - statuses.unverified;
  const attendance = {
    ...statuses,
    marked,
    attended,
    rate: countable > 0 ? Math.round((attended / countable) * 100) : null,
  };

  const weeks = new Map();
  rows.forEach((row) => {
    const key = weekStart(DAY(row));
    const bucket = weeks.get(key) || [];
    bucket.push(Number(row.rating) || 0);
    weeks.set(key, bucket);
  });
  const trend = [...weeks.entries()]
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
    .slice(-6)
    .map(([week, list]) => ({ week, value: average(list), count: list.length }));

  const notes = [...rows]
    .reverse()
    .filter((row) => row.improvement || row.next_focus || row.note)
    .slice(0, 2)
    .map((row) => ({
      id: row.id,
      date: row.date,
      mentor_name: row.mentor_name || "Mentor",
      improvement: row.improvement || "",
      next_focus: row.next_focus || "",
      note: row.note || "",
    }));

  return {
    sessions: rows.length,
    overall,
    band: bandFor(overall),
    criteria,
    strongest,
    focus,
    tags,
    attendance,
    trend,
    notes,
    hasData: rows.length > 0,
  };
}