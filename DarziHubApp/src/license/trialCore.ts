// One-time free trial (demo): 7 days per device, only while no license has been activated. Pure logic, no storage.
export const TRIAL_DAYS = 7;
const DAY = 86400000;
const SKEW = 5 * 60 * 1000; // tolerated clock drift

export type TrialState =
  | { status: 'unused' }
  | { status: 'active'; daysLeft: number }
  | { status: 'expired' }
  | { status: 'clock' };

/** start = when the trial began (ms) or undefined if never started; lastSeen = latest time the app has ever seen (ms). */
export function evalTrial(start: number | undefined, now: number, lastSeen?: number): TrialState {
  if (start === undefined) return { status: 'unused' };
  if (now < start - SKEW || (lastSeen !== undefined && now < lastSeen - SKEW)) return { status: 'clock' };
  const end = start + TRIAL_DAYS * DAY;
  if (now >= end) return { status: 'expired' };
  return { status: 'active', daysLeft: Math.max(1, Math.ceil((end - now) / DAY)) };
}
