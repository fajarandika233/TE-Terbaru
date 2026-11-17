import { LEVEL_LABEL, jakartaToday } from "@/lib/portal";

// Progress engine. Every chart point and every number comes from the student's own
// mentor feedback and attendance rows. Nothing is estimated or invented.

export const RANGES = [
  { id: "1m", label: "Last 1 Month", days: 30 },
  { id: "3m", label: "Last 3 Months", days: 90 },
  { id: "all", label: "All Time", days: 0 },
];

export const SCORE_CARDS = [
  { key: "speaking", label: "Speaking Score" },
  { key: "confidence", label: "Confidence" },
  { key: "pronunciation", label: "Pronunciation" },
  { key: "vocabulary", label: "Vocabulary & Grammar" },
  { key: "fluency", label: "Fluency" },
  { key: "listening", label: "Listening" },
];

const ATTENDED = ["confirmed", "partial", "late"];
const SKIPPED = ["excused", "unverified"];

const DAY = (row) => String(row?.date || "").slice(0, 10);
const mean = (list) => (list.length ? list.reduce((sum, value) => sum + value, 0) / list.length : 0);

export const chartDate = (date) =>
  new Date(`${date}T00:00:00+07:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Jakarta",
  });

export function progressDateQuery(range) {
  const days = RANGES.find((item) => item.id === range)?.days || 0;
  const today = jakartaToday();
  if (!days) return { $lte: today };
  const cutoff = new Date(`${today}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  return { $gte: cutoff.toISOString().slice(0, 10), $lte: today };
}

const change = (value, previous) => (previous > 0 ? Math.round(((value - previous) / previous) * 1000) / 10 : null);
const withChanges = (points) =>
  points.map((point, index) => ({ ...point, delta: index ? change(point.value, points[index - 1].value) : null }));

// One point per review day (1-5 rubric becomes 0-100). The card shows the period
// average, while the badge shows the real change of the latest day over the one
// before it.
function scoreFor(rows = [], key) {
  const byDate = new Map();
  rows.forEach((row) => {
    const value = Number(row[key]) || 0;
    if (value <= 0) return;
    const day = DAY(row);
    byDate.set(day, [...(byDate.get(day) || []), value]);
  });

  const points = withChanges(
    [...byDate.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, list]) => ({ date, value: Math.round(mean(list) * 20), count: list.length }))
  );
  if (!points.length) return { value: null, count: 0, points: [], delta: null, latest: null };

  const count = points.reduce((total, point) => total + point.count, 0);
  const value = Math.round(points.reduce((total, point) => total + point.value * point.count, 0) / count);
  return {
    value,
    count,
    points,
    delta: points[points.length - 1].delta,
    latest: points[points.length - 1].value,
  };
}

// Cumulative attendance, so the line shows the real rate after each class day.
function attendanceFor(rows = []) {
  const byDate = new Map();
  rows
    .filter((row) => !SKIPPED.includes(row.status))
    .forEach((row) => {
      const day = DAY(row);
      const current = byDate.get(day) || { total: 0, present: 0 };
      byDate.set(day, {
        total: current.total + 1,
        present: current.present + (ATTENDED.includes(row.status) ? 1 : 0),
      });
    });

  let total = 0;
  let attended = 0;
  const points = withChanges(
    [...byDate.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, day]) => {
        total += day.total;
        attended += day.present;
        return { date, value: Math.round((attended / total) * 100) };
      })
  );

  return {
    rate: total ? Math.round((attended / total) * 100) : null,
    attended,
    total,
    points,
    delta: points.length ? points[points.length - 1].delta : null,
  };
}

function bannerFor(overall, hasScores) {
  if (!hasScores) {
    return {
      title: "Let's start!",
      text: "Your progress fills in as soon as your mentor sends the first review after class.",
    };
  }
  if (overall >= 88) return { title: "Keep going!", text: "You're doing great. Let's reach an even higher level! 💪" };
  if (overall >= 72) return { title: "Nice progress!", text: "Your speaking is getting stronger every session. Keep it up! 💪" };
  return { title: "Good start!", text: "Every class counts — speak one more time tonight than last time. 💪" };
}

export function buildProgress({ feedback = [], profile = {}, rows = [], attendanceRows = [], range = "1m" }) {
  const dateQuery = progressDateQuery(range);
  const inRange = (row) => DAY(row) <= dateQuery.$lte && (!dateQuery.$gte || DAY(row) >= dateQuery.$gte);

  const rated = rows.filter((row) => Number(row.rating) > 0 && inRange(row));
  const scores = SCORE_CARDS.map((card) => ({ ...card, ...scoreFor(rated, card.key) }));
  const overallScore = scoreFor(rated, "rating");
  const attendance = attendanceFor(attendanceRows.filter(inRange));
  const hasScores = overallScore.count > 0;

  const latest =
    feedback.filter(inRange).slice().sort((a, b) => DAY(b).localeCompare(DAY(a)) || String(b.created_at || "").localeCompare(String(a.created_at || "")))[0] ||
    feedback[0] ||
    null;
  const points = overallScore.points;

  return {
    hasScores,
    sessions: overallScore.count,
    overall: overallScore.value,
    scores,
    attendance,
    level: profile.level || "beginner",
    levelLabel: LEVEL_LABEL[profile.level] || "Beginner",
    banner: bannerFor(overallScore.value || 0, hasScores),
    latest,
    journey: {
      ...overallScore,
      startLabel: points.length ? chartDate(points[0].date) : "",
      endLabel: points.length ? chartDate(points[points.length - 1].date) : "",
    },
  };
}