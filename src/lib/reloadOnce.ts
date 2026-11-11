// After a deploy an open tab may ask for a chunk the new build removed. Reload to pick up the new build.
// At most once per 10 s, and never when storage is unreadable, so a chunk that stays unreachable (offline) cannot cause a reload loop.
// Service workers are dropped first: otherwise the reload can be answered with the old precached index.html, which names the same missing chunk.
export const isChunkError = (e: unknown): boolean =>
  /dynamically imported module|Importing a module script failed|Unable to preload CSS/i.test(String((e as { message?: string })?.message ?? e));

export function reloadOnce(): boolean {
  if (!navigator.onLine) return false; // offline: keep the service worker, its cached shell is all the user has
  try {
    const last = Number(sessionStorage.getItem('scnr_reloaded') || 0);
    if (Date.now() - last < 10_000) return false;
    sessionStorage.setItem('scnr_reloaded', String(Date.now()));
  } catch { return false; }
  const go = () => window.location.reload();
  if (!('serviceWorker' in navigator)) { go(); return true; }
  navigator.serviceWorker.getRegistrations().then(rs => Promise.all(rs.map(r => r.unregister()))).catch(() => {}).then(go);
  return true;
}
