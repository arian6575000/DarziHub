import assert from 'node:assert/strict';
import { buildPayload, generateKeyPair, signLicense, verifyLicense } from '../src/license/licenseCore';

const kp = generateKeyPair();
const other = generateKeyPair();
const DEV = 'AAAA-BBBB-CCCC-DDDD-EEEE';
const mk = (project = 'darzihub', expiry: any = { days: 30 }, now?: Date) =>
  signLicense(buildPayload({ machineId: DEV, clientName: 'Test Tailor', planName: 'Pro', maxUsers: 1, features: {}, expiry, idFormat: 'hex20', project: { code: project, legacy: false }, now }), kp.privateKeyHex);
const v = (lic: string, o: any = {}) => verifyLicense(lic, { publicKeyHex: kp.publicKeyHex, machineId: DEV, projectCode: 'darzihub', ...o });

// valid
let r = v(mk()); assert.equal(r.ok, true);
// lifetime
r = v(mk('darzihub', 'lifetime')); assert.equal(r.ok && r.daysLeft, null);
// wrong key
assert.deepEqual(verifyLicense(mk(), { publicKeyHex: other.publicKeyHex, machineId: DEV, projectCode: 'darzihub' }), { ok: false, reason: 'signature' });
// other device
assert.deepEqual(v(mk(), { machineId: '1111-2222-3333-4444-5555' }), { ok: false, reason: 'machine' });
// other project
assert.deepEqual(v(mk('bpjourney')), { ok: false, reason: 'project' });
// expired
assert.deepEqual(v(mk(), { now: Date.now() + 40 * 86400000 }), { ok: false, reason: 'expired' });
// clock rollback
assert.deepEqual(v(mk(), { lastSeen: Date.now() + 3 * 86400000 }), { ok: false, reason: 'clock' });
// tampered payload
const lic = mk(); const [h, sig] = lic.split('.');
const bad = h.slice(0, -4) + (h.endsWith('AAAA') ? 'BBBB' : 'AAAA') + '.' + sig;
assert.equal(v(bad).ok, false);
// garbage
assert.deepEqual(v('hello'), { ok: false, reason: 'format' });
console.log('license tests passed');
