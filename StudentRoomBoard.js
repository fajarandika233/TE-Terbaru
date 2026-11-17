export const roomFromAvailability = (row) => ({ ...row, id: row.room_id, availability_id: row.id });

// Only today's rooms live on the student board, so a room opened or closed shows
// up (or disappears) at once without waiting for the next reload.
export function applyRoomEvent(prev, event) {
  if (!prev) return prev;
  const row = event.data;
  const existing = (prev.rooms || []).find((room) => room.availability_id === event.id);
  if (row?.updated_date && existing?.updated_date && row.updated_date < existing.updated_date) return prev;

  const matchesRoom = (room) =>
    room.availability_id !== event.id && (!row?.room_id || room.id !== row.room_id);

  if (event.type === "delete" || row?.active === false) {
    return { ...prev, rooms: (prev.rooms || []).filter(matchesRoom) };
  }
  if (!row?.room_id || row.date !== prev.date) return prev;
  return { ...prev, rooms: [...(prev.rooms || []).filter(matchesRoom), roomFromAvailability(row)] };
}