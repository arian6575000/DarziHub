// RetailX License Hub: pure helpers (no network, no storage) so the kill-switch logic can be unit-tested.
export type HubVerdict = 'blocked' | 'ok' | 'unknown';

const BLOCKED = ['blocked', 'block', 'quarantine', 'quarantined', 'revoked', 'suspended', 'killed', 'disabled', 'banned'];

/** Reads a Hub reply (activate / heartbeat / status). Anything unclear is 'unknown' -> the app keeps its last known state (fails open). */
export function interpretHubReply(body: unknown): HubVerdict {
  if (!body || typeof body !== 'object') return 'unknown';
  const b = body as Record<string, unknown>;
  if (b.is_blocked === true || b.blocked === true || b.kill_switch === true || b.killed === true || b.revoked === true) return 'blocked';
  const raw = [b.status, b.license_status, b.state].find((v) => typeof v === 'string') as string | undefined;
  if (!raw) return 'unknown';
  return BLOCKED.includes(raw.trim().toLowerCase()) ? 'blocked' : 'ok';
}

export const HUB_SYNC_EVERY_MS = 6 * 60 * 60 * 1000;
export const shouldSync = (lastSync: number | undefined, now: number, force = false) =>
  force || lastSync === undefined || now < lastSync || now - lastSync >= HUB_SYNC_EVERY_MS;
