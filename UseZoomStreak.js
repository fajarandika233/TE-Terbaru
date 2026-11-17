import { useCallback, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { jakartaToday, shiftDate } from "@/lib/portal";
import { buildStreak } from "@/lib/streak";

const listOf = (value) => (Array.isArray(value) ? value : value?.items || []);

// Daily Zoom streak from this student's own trail: the seats they reserved,
// the Zoom rooms they opened, and the attendance their mentor marked.
// Viewing the portal alone leaves no signal, so it can never light the flame.
export default function useZoomStreak(userId, memberSince = "") {
  const [streak, setStreak] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    const today = jakartaToday();
    const from = shiftDate(today, -150);
    const page = { sort: "-date", limit: 200 };

    (async () => {
      try {
        const [attendance, sessions, seats, clicks] = await Promise.all([
          base44.entities.Attendance.filter({ user_id: userId }, page),
          base44.entities.DailySession.filter({ date: { $gte: from } }, page),
          base44.entities.SeatReservation.filter({ user_id: userId, date: { $gte: from } }, page),
          base44.entities.ZoomClick.filter({ user_id: userId, date: { $gte: from } }, page),
        ]);
        if (cancelled) return;
        setStreak(
          buildStreak({
            attendance: listOf(attendance),
            reservations: listOf(seats),
            clicks: listOf(clicks),
            sessions: listOf(sessions),
            today,
            memberSince,
          })
        );
      } catch {
        if (!cancelled) setStreak(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, memberSince, tick]);

  // Coming back from a Zoom tab refreshes the flame on its own.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") setTick((value) => value + 1);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const refresh = useCallback(() => setTick((value) => value + 1), []);

  return { streak, refresh };
}