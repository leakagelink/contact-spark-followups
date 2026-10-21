/**
 * Return-from-dialer follow-up.
 *
 * Browsers (and Capacitor without a call-state plugin) cannot know whether a call happened or ended.
 * We store a pending context when the user taps Call, and when the app becomes active again
 * (visibilitychange / Capacitor appStateChange) we offer a follow-up prompt for that same contact.
 */
export type PendingCall = {
  contactId: string;
  name: string;
  phone: string;
  activityId: string | null;
  startedAt: number;
  leftAppAt: number | null;
  handled: boolean;
};

const KEY = "cf.pendingCall";
/** Prompts older than this are considered stale and are discarded. */
export const MAX_AGE_MS = 2 * 60 * 60 * 1000;
/** Must have been away at least this long — avoids prompting when the dialer never opened. */
export const MIN_AWAY_MS = 1500;

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function savePending(p: Omit<PendingCall, "handled" | "leftAppAt" | "startedAt">, store: Store, now = Date.now()) {
  const v: PendingCall = { ...p, startedAt: now, leftAppAt: null, handled: false };
  store.setItem(KEY, JSON.stringify(v));
  return v;
}

export function readPending(store: Store): PendingCall | null {
  try {
    const raw = store.getItem(KEY);
    return raw ? (JSON.parse(raw) as PendingCall) : null;
  } catch {
    return null;
  }
}

export function markLeft(store: Store, now = Date.now()) {
  const p = readPending(store);
  if (p && !p.handled && p.leftAppAt == null) store.setItem(KEY, JSON.stringify({ ...p, leftAppAt: now }));
}

/** Decide whether to show the prompt now that the app is active again. */
export function shouldPrompt(p: PendingCall | null, now = Date.now()): boolean {
  if (!p || p.handled) return false;
  if (now - p.startedAt > MAX_AGE_MS) return false;
  if (p.leftAppAt == null) return false;
  return now - p.leftAppAt >= MIN_AWAY_MS;
}

export function markHandled(store: Store) {
  const p = readPending(store);
  if (p) store.setItem(KEY, JSON.stringify({ ...p, handled: true }));
}

export function clearIfStale(store: Store, now = Date.now()) {
  const p = readPending(store);
  if (p && (p.handled || now - p.startedAt > MAX_AGE_MS)) store.removeItem(KEY);
}
