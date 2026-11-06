import assert from 'node:assert/strict';
import { FEATURE_DEFAULTS, featureOn } from '../src/license/permissions';
import spec from '../src/license/permissions.json';
assert.equal(featureOn({}, 'stock.manage'), true);                       // not mentioned -> schema default
assert.equal(featureOn({ 'stock.manage': false }, 'stock.manage'), false); // license says no
assert.equal(featureOn({ 'backup.export': true }, 'backup.export'), true);
assert.equal(featureOn(undefined, 'print.receipts'), true);
assert.equal(spec.project.code, 'darzihub');
assert.ok(Object.keys(FEATURE_DEFAULTS).length >= 6);
console.log('permissions tests passed');
