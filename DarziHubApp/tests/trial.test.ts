import assert from 'node:assert/strict';
import { evalTrial, TRIAL_DAYS } from '../src/license/trialCore';

const DAY = 86400000;
const t0 = Date.UTC(2026, 10, 16);
assert.deepEqual(evalTrial(undefined, t0), { status: 'unused' });
assert.deepEqual(evalTrial(t0, t0), { status: 'active', daysLeft: TRIAL_DAYS });
assert.deepEqual(evalTrial(t0, t0 + 3 * DAY), { status: 'active', daysLeft: 4 });
assert.deepEqual(evalTrial(t0, t0 + 7 * DAY - 1000), { status: 'active', daysLeft: 1 });
assert.deepEqual(evalTrial(t0, t0 + 7 * DAY), { status: 'expired' });
assert.deepEqual(evalTrial(t0, t0 + 30 * DAY), { status: 'expired' });
// clock moved back after the app saw a later time
assert.deepEqual(evalTrial(t0, t0 + 1 * DAY, t0 + 5 * DAY), { status: 'clock' });
assert.deepEqual(evalTrial(t0, t0 - 2 * DAY), { status: 'clock' });
console.log('trial.test.ts OK');
