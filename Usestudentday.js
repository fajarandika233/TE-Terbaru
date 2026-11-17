import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { messageOf } from "@/lib/portalRequest";
import { roomFromAvailability, applyRoomEvent } from "@/lib/studentRoomBoard";
import { classPhase, closeClock, pickTopicDate, unlockClock } from "@/lib/portal";
import useNow from "@/hooks/useNow";

// Room metadata and counts arrive on a sanitized realtime channel.
// Private student records use the student's own read budget, not the shared
// service-role budget. Booking responses patch local state immediately.
const MIN_GAP = 60000;
const RETRY_AFTER = 30000;

const listOf = (value) => (Array.isArray(value) ? value : value?.items || []);

export default function useStudentDay(date, userId) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const inflight = useRef(null);
  const lastAt = useRef(0);
  const trailing = useRef(null);
  const retry = useRef(null);

  const build = useCallback(async () => {
    if (!userId) return;
    // The student home shows one day only: today. Other dates belong to the
    // mentors and the owner, apart from big events fetched separately below.
    const availability = listOf(await base44.entities.RoomAvailability.filter({ date, active: true }, { limit: 100 }));
    const roomRows = availability.map(roomFromAvailability);
    const board = { rooms: roomRows, isWeekend: [0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay()) };

    // Do not turn a failed private read into an empty reservation list.
    const safe = (call) => call;

    const [settingsRes, sessionRes, materialRes, seatRes, attRes, clickRes, feedbackRes, eventsRes] = await Promise.all([
      safe(base44.entities.SystemSettings.filter({ key: "global" })),
      safe(base44.entities.DailySession.filter({ date })),
      safe(base44.entities.LessonMaterial.filter({ date: { $gte: date }, published: true }, { sort: "date", limit: 24 })),
      safe(base44.entities.SeatReservation.filter({ user_id: userId, date })),
      safe(base44.entities.Attendance.filter({ user_id: userId, date })),
      safe(base44.entities.ZoomClick.filter({ user_id: userId, date })),
      safe(base44.entities.MentorFeedback.filter({ student_user_id: userId }, { sort: "-date", limit: 100 })),
      safe(base44.entities.PortalEvent.filter({ published: true, date: { $gte: date } }, { sort: "date", limit: 5 })),
    ]);

    const settingsRow = listOf(settingsRes)[0] || {};
    const settings = {
      membership_days: Number(settingsRow.membership_days) || 30,
      class_time: settingsRow.class_time || "20:00",
      max_students: Number(settingsRow.max_students) || 6,
    };

    const sessions = listOf(sessionRes);
    const sessionRow = sessions.find((row) => row.date === date) || null;
    const classTime = sessionRow?.class_time || settings.class_time;

    // Materials for today and every published date after it: the home screen needs
    // tomorrow's topic once the clock passes 22:00 Jakarta time.
    const materials = listOf(materialRes);
    const materialsByDate = {};
    materials.forEach((row) => {
      materialsByDate[row.date] = [...(materialsByDate[row.date] || []), row];
    });
    const seats = listOf(seatRes).filter((row) => row.status !== "cancelled");
    const clicks = listOf(clickRes);
    const attendanceRow = listOf(attRes)[0] || null;

    const myFeedback = listOf(feedbackRes)
      .map((row) => ({
        id: row.id,
        date: row.date,
        level: row.level,
        mentor_name: row.mentor_name || "Mentor",
        mentor_avatar: row.mentor_avatar || "",
        rating: Number(row.rating) || 0,
        speaking: Number(row.speaking) || 0,
        confidence: Number(row.confidence) || 0,
        pronunciation: Number(row.pronunciation) || 0,
        vocabulary: Number(row.vocabulary) || 0,
        fluency: Number(row.fluency) || 0,
        listening: Number(row.listening) || 0,
        room_id: row.room_id || "",
        tags: Array.isArray(row.tags) ? row.tags : [],
        strengths: row.strengths || "",
        improvement: row.improvement || "",
        next_focus: row.next_focus || "",
        note: row.note || "",
        read_at: row.read_at || "",
        created_at: row.updated_date || row.created_date,
      }))
      .sort(
        (a, b) => String(b.date).localeCompare(String(a.date)) || String(b.created_at).localeCompare(String(a.created_at))
      )
      .slice(0, 40);

    const rated = myFeedback.filter((item) => item.rating > 0);
    const seatsOn = (day) => seats.filter((row) => row.date === day).map((row) => ({ room_id: row.room_id, status: row.status }));

    return {
      date,
      isStaff: false,
      isWeekend: !!board.isWeekend,
      settings,
      capacity: settings.max_students,
      classTime,
      phase: classPhase(date, classTime),
      unlockClock: unlockClock(classTime),
      closeClock: closeClock(classTime),
      session: sessionRow
        ? {
            date: sessionRow.date,
            published_levels: sessionRow.published_levels || [],
            class_time: sessionRow.class_time,
            is_off: !!sessionRow.is_off,
            note: sessionRow.note || "",
          }
        : null,
      publishedLevels: sessionRow?.published_levels || [],
      materials: materialsByDate[date] || [],
      materialsByDate,
      // The owner's seat limit is the authority for every room, so a change in
      // settings reaches the student board without republishing the room.
      rooms: (board.rooms || []).map((room) => ({ ...room, capacity: settings.max_students })),
      lock: null,
      myClicks: clicks.map((row) => ({
        room_id: row.room_id || "",
        level: row.level,
        mentor_name: row.mentor_name || "",
        clicked_at: row.clicked_at,
      })),
      mySeats: seatsOn(date),
      myAttendanceToday: attendanceRow
        ? { status: attendanceRow.status, level: attendanceRow.level, mentor_name: attendanceRow.mentor_name || "" }
        : null,
      myFeedback,
      unreadFeedback: myFeedback.filter((item) => !item.read_at).length,
      feedbackSummary: rated.length
        ? {
            count: rated.length,
            average: Math.round((rated.reduce((sum, item) => sum + item.rating, 0) / rated.length) * 10) / 10,
          }
        : null,
      decks: [],
      events: listOf(eventsRes)
        .map((row) => ({
          id: row.id,
          title: row.title || "",
          description: row.description || "",
          date: row.date,
          start_time: row.start_time || "",
          end_time: row.end_time || "",
          location: row.location || "",
          link_url: row.link_url || "",
          cta_label: row.cta_label || "",
        }))
        .slice(0, 3),
    };
  }, [date, userId]);

  const run = useCallback(() => {
    if (!userId) return null;
    if (inflight.current) return inflight.current;
    lastAt.current = Date.now();
    inflight.current = (async () => {
      try {
        const payload = await build();
        setData(payload);
        setError("");
        if (retry.current) {
          clearTimeout(retry.current);
          retry.current = null;
        }
      } catch (err) {
        setError(messageOf(err) || "Could not refresh. Tap retry.");
        if (!retry.current) {
          retry.current = setTimeout(() => {
            retry.current = null;
            run();
          }, RETRY_AFTER);
        }
      } finally {
        inflight.current = null;
      }
    })();
    return inflight.current;
  }, [build, userId]);

  const reload = useCallback(() => {
    if (trailing.current) {
      clearTimeout(trailing.current);
      trailing.current = null;
    }
    return run();
  }, [run]);

  const refresh = useCallback(() => {
    if (inflight.current || trailing.current) return;
    const wait = MIN_GAP - (Date.now() - lastAt.current);
    if (wait <= 0) {
      run();
      return;
    }
    trailing.current = setTimeout(() => {
      trailing.current = null;
      run();
    }, wait);
  }, [run]);

  const patch = useCallback((updater) => {
    setData((prev) => (prev ? updater(prev) : prev));
  }, []);

  useEffect(() => {
    run();
  }, [run]);

  useEffect(() => {
    let seatTimer;
    let roomTimer;
    const scheduleRefresh = () => {
      clearTimeout(roomTimer);
      roomTimer = setTimeout(refresh, 400);
    };
    const unsubs = [
      base44.entities.RoomAvailability.subscribe((event) => {
        // A room opening or closing shows up instantly; the throttled refresh
        // then fills in the authoritative seat counts and class time.
        setData((prev) => applyRoomEvent(prev, event));
        scheduleRefresh();
      }),
      base44.entities.DailySession.subscribe((event) => {
        const row = event.data;
        if (!row || row.date !== date) return;
        setData((prev) => prev ? { ...prev, classTime: row.class_time || prev.classTime, session: { ...prev.session, ...row } } : prev);
      }),
      base44.entities.SeatReservation.subscribe((event) => {
        if (event.data?.user_id !== userId) return;
        clearTimeout(seatTimer);
        seatTimer = setTimeout(async () => {
          const rows = listOf(await base44.entities.SeatReservation.filter({ user_id: userId, date: { $gte: date }, status: { $ne: "cancelled" } }));
          setData((prev) => prev ? { ...prev, mySeats: rows.filter((row) => row.date === date).map((row) => ({ room_id: row.room_id, status: row.status })) } : prev);
        }, 150);
      }),
      base44.entities.MentorFeedback.subscribe(refresh),
    ];
    return () => { clearTimeout(seatTimer); clearTimeout(roomTimer); unsubs.forEach((fn) => fn && fn()); };
  }, [date, userId, refresh]);

  useEffect(() => {
    const onFocus = () => {
      if (Date.now() - lastAt.current > MIN_GAP * 2) refresh();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") onFocus();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  useEffect(
    () => () => {
      if (trailing.current) clearTimeout(trailing.current);
      if (retry.current) clearTimeout(retry.current);
    },
    []
  );

  // Before 22:00 the home screen shows tonight's topic; from 22:00 it switches to
  // the next published topic, so after midnight "today" is already correct.
  const clock = useNow(60000);
  const topic = useMemo(() => {
    const map = data?.materialsByDate || {};
    const day = pickTopicDate(map, data?.date || date, clock);
    return { date: day, materials: map[day] || [], isNext: Boolean(data?.date) && day > data.date };
  }, [data, date, clock]);

  return { data, error, reload, refresh, patch, topic };
}