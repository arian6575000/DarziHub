import assert from 'node:assert/strict';
import { groupsFor, setShopType, visibleGarments } from '../src/lib/garments';
import { buildReceiptHtml } from '../src/lib/receiptHtml';
import { CREDIT } from '../src/lib/brand';
import { DEFAULT_SETTINGS } from '../src/db/types';

setShopType('both');
assert.deepEqual(groupsFor('gents'), ['gents', 'other']);
assert.deepEqual(groupsFor(undefined), ['gents', 'ladies', 'other']);
setShopType('ladies');
assert.deepEqual(groupsFor('gents'), ['ladies', 'other']); // shop type wins
assert.ok(visibleGarments().every((g) => g.group !== 'gents') && visibleGarments().length > 0);
setShopType('gents');
assert.ok(visibleGarments('ladies').every((g) => g.group !== 'ladies'));
setShopType('both');

const order: any = { orderNumber: 'ORD-1', orderDate: '2026-11-02', deliveryDate: '', trialDate: '', items: [{ garment: 'qameez', qty: 1, rate: 100, fabricAmount: 0, notes: '' }], measurements: {}, discount: 0, photos: [], urgent: false, fabricReceived: '', fabricMeters: 0 };
for (const view of ['receipt', 'slip', 'tag', 'fabric'] as const)
  for (const fmt of ['thermal80', 'thermal58', 'a4'] as const) {
    const html = buildReceiptHtml({ order, customer: { name: 'A', phone: '1' } as any, settings: DEFAULT_SETTINGS, payments: [], photoDataUrls: [] } as any, { view, fmt, lang: 'en', mode: 'print' });
    assert.ok(html.includes(CREDIT), `${view}/${fmt} missing credit`);
  }
console.log('shop type + credit tests passed');
