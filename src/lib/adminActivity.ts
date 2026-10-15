// Lets a screen tell the admin layout "I'm busy, don't sign me out for inactivity."
// Used while a podcast is being recorded or uploaded, when nobody is touching the screen.
const holds = new Map<number, number>();
let nextId = 0;

/** Pause the admin inactivity sign-out. Call the returned function to let it resume. */
export function holdAdminSession(): () => void {
  const id = ++nextId;
  holds.set(id, Date.now());
  return () => {
    holds.delete(id);
  };
}

/** True while something is holding the session. A hold older than 3 hours is dropped as a safety net. */
export function adminSessionHeld(maxMs = 3 * 60 * 60 * 1000): boolean {
  const now = Date.now();
  holds.forEach((since, id) => {
    if (now - since > maxMs) holds.delete(id);
  });
  return holds.size > 0;
}
