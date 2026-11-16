import assert from 'node:assert/strict';
import { HUB_SYNC_EVERY_MS, interpretHubReply, shouldSync } from '../src/license/hubCore';

assert.equal(interpretHubReply({ status: 'active' }), 'ok');
assert.equal(interpretHubReply({ status: 'Blocked' }), 'blocked');
assert.equal(interpretHubReply({ license_status: 'quarantine' }), 'blocked');
assert.equal(interpretHubReply({ is_blocked: true, status: 'active' }), 'blocked');
assert.equal(interpretHubReply({ kill_switch: true }), 'blocked');
assert.equal(interpretHubReply({ detail: 'Not found' }), 'unknown');
assert.equal(interpretHubReply(null), 'unknown');
assert.equal(interpretHubReply('x'), 'unknown');

const t = 1_000_000_000;
assert.equal(shouldSync(undefined, t), true);
assert.equal(shouldSync(t, t + 1000), false);
assert.equal(shouldSync(t, t + HUB_SYNC_EVERY_MS), true);
assert.equal(shouldSync(t, t + 1000, true), true);
assert.equal(shouldSync(t + 5000, t), true); // clock moved back -> sync
console.log('hub.test.ts OK');
