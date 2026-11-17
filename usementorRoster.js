import { useCallback, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

// Shared roster for the mentor's Absensi and Feedback sections: who joined the rooms of
// the selected day, their roll-call status, and any feedback already written.
export default function useMentorRoster(date) {
  const [state, setState] = useState({ data: null, error: "" });

  const load = useCallback(async () => {
    if (!date) return;
    try {
      const res = await base44.functions.invoke("mentorRoster", { date });
      setState({ data: res.data, error: "" });
    } catch (err) {
      setState({ data: null, error: err?.response?.data?.error || "Daftar murid gagal dimuat." });
    }
  }, [date]);

  useEffect(() => {
    setState({ data: null, error: "" });
    load();
  }, [load]);

  return { ...state, reload: load };
}