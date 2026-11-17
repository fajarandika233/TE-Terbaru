import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

const listOf = (value) => (Array.isArray(value) ? value : value?.items || []);

// A student's own class history — attendance rows and the topic of that day.
// Both are readable with the student's own token, so this never touches the
// shared backend budget.
export default function usePortalHistory(date, profile) {
  const [history, setHistory] = useState(null);
  const userId = profile?.user_id || "";
  const level = profile?.level || "beginner";

  useEffect(() => {
    if (!userId) return undefined;
    let alive = true;
    Promise.all([
      base44.entities.Attendance.filter({ user_id: userId }, { sort: "-date", limit: 60 }),
      base44.entities.LessonMaterial.filter({ level }, { limit: 120 }),
    ])
      .then(([attendance, materials]) => {
        if (!alive) return;
        const byDate = new Map();
        for (const item of listOf(materials)) byDate.set(item.date, item);
        setHistory({
          classes: listOf(attendance).map((row) => ({
            id: row.id,
            date: row.date,
            level: row.level,
            mentor_name: row.mentor_name || "",
            status: row.status,
            topic: byDate.get(row.date)?.topic || "",
          })),
        });
      })
      .catch(() => alive && setHistory({ classes: [] }));
    return () => {
      alive = false;
    };
  }, [date, userId, level]);

  return history;
}