import { useCallback, useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { invokePortal } from "@/lib/portalRequest";

// The platform allows 70 entity reads per caller per minute, and one portal load
// spends ~11 of them. So background refreshes never run closer than this, and
// every refresh is single-flight: bursts of realtime events collapse into one
// call instead of one call per event.
const MIN_GAP = 45000;
const RETRY_AFTER = 25000;

export default function usePortalDay(date, { poll = 0 } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const inflight = useRef(null);
  const lastAt = useRef(0);
  const trailing = useRef(null);
  const retry = useRef(null);

  const run = useCallback(() => {
    if (inflight.current) return inflight.current;
    lastAt.current = Date.now();
    inflight.current = (async () => {
      try {
        const res = await invokePortal("portalToday", { date });
        setData(res.data || null);
        setError("");
        if (retry.current) {
          clearTimeout(retry.current);
          retry.current = null;
        }
      } catch (err) {
        setError("Could not refresh. Tap retry.");
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
  }, [date]);

  // User-triggered reload (retry button, role edits) — always runs now.
  const reload = useCallback(() => {
    if (trailing.current) {
      clearTimeout(trailing.current);
      trailing.current = null;
    }
    return run();
  }, [run]);

  // Background refresh — never closer than MIN_GAP to the previous call.
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

  // Local patch: the UI updates instantly after an action, without spending
  // another server read.
  const patch = useCallback((updater) => {
    setData((prev) => (prev ? updater(prev) : prev));
  }, []);

  useEffect(() => {
    run();
  }, [run]);

  useEffect(() => {
    const unsubs = [
      base44.entities.DailySession.subscribe(refresh),
      base44.entities.LessonMaterial.subscribe(refresh),
      base44.entities.ClassDeck.subscribe(refresh),
      base44.entities.MentorFeedback.subscribe(refresh),
    ];
    return () => unsubs.forEach((fn) => fn && fn());
  }, [refresh]);

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

  useEffect(() => {
    if (!poll) return undefined;
    const timer = setInterval(refresh, Math.max(poll, MIN_GAP));
    return () => clearInterval(timer);
  }, [poll, refresh]);

  useEffect(
    () => () => {
      if (trailing.current) clearTimeout(trailing.current);
      if (retry.current) clearTimeout(retry.current);
    },
    []
  );

  return { data, error, reload, refresh, patch };
}