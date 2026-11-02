import assert from 'node:assert/strict';
import { createNodeDb } from './nodeDb';
import { initRepo, Repo, getDb } from '../src/db/repo';
import { exportAll, importAll } from '../src/db/backupCore';
import { calcOrder } from '../src/lib/calc';
import { todayStr, addDays } from '../src/lib/dates';
import { readFileSync } from 'node:fs';

const photoIO = {
  async toDataUrl(f: string) { return `data:image/jpeg;base64,${Buffer.from(f).toString('base64')}`; },
  async fromDataUrl(u: string) { return Buffer.from(u.split(',')[1], 'base64').toString(); },
};
let passed = 0;
const ok = (name: string) => { passed++; console.log('  ✓', name); };

async function main() {
  await initRepo(createNodeDb());
  const ver = await getDb().getFirstAsync<any>('PRAGMA user_version');
  assert.equal(ver.user_version, 1); ok('migration sets user_version');
  const fk = await getDb().getFirstAsync<any>('PRAGMA foreign_keys');
  assert.equal(fk.foreign_keys, 1); ok('foreign keys on');

  // settings
  const s = await Repo.getSettings();
  assert.equal(s.orderPrefix, 'ORD');
  s.rates = { qameez: 1500 }; s.shopName = 'Test Shop'; await Repo.saveSettings(s);
  assert.equal((await Repo.getSettings()).rates.qameez, 1500); ok('settings round-trip');

  // customers + family + measurements
  const head = await Repo.saveCustomer({ name: 'Ahmed Khan', phone: '0300-1234567', gender: 'gents' });
  const wife = await Repo.saveCustomer({ name: 'Ayesha', gender: 'ladies', headId: head, phone: '0300-1234567' });
  await Repo.saveMeasurement(head, 'qameez', { length: '40', chest: '42' }, 'band collar');
  const c = await Repo.getCustomer(head);
  assert.equal(c!.measurements!.qameez.values.chest, '42');
  assert.equal(c!.measurements!.qameez.style, 'band collar');
  assert.equal((await Repo.listMembers(head)).length, 1);
  await assert.rejects(() => Repo.deleteCustomer(head), /customerHasMembers/); ok('customers, measurements, family rules');

  // orders
  const snap = { qameez: c!.measurements!.qameez };
  const base = { customerId: head, orderDate: todayStr(), deliveryDate: todayStr(), trialDate: addDays(1), urgent: true, discount: 100, notes: 'n',
    fabricReceived: 'grey', fabricMeters: 2.5, measurements: snap, photos: ['a.jpg', 'b.jpg'],
    items: [{ garment: 'qameez', qty: 2, rate: 1500, fabricAmount: 0, notes: '' }, { garment: 'shalwar', qty: 2, rate: 500, fabricAmount: 200, notes: 'x' }] };
  const oid = await Repo.saveOrder(base as any, 1000);
  const o = (await Repo.getOrder(oid))!;
  assert.match(o.orderNumber, new RegExp(`^ORD-${new Date().getFullYear()}-001$`));
  assert.equal(o.items.length, 2); assert.deepEqual(o.photos, ['a.jpg', 'b.jpg']); assert.equal(o.urgent, true);
  const calc = calcOrder(o); assert.equal(calc.subtotal, 4200); assert.equal(calc.total, 4100);
  assert.equal(await Repo.orderPaid(oid), 1000);
  const oid2 = await Repo.saveOrder({ ...base, urgent: false } as any, 0);
  assert.match((await Repo.getOrder(oid2))!.orderNumber, /-002$/); ok('order create, numbering, advance payment, totals');

  // edit order replaces items/photos, keeps number/status
  await Repo.setOrderStatus(oid, 'stitching');
  await Repo.saveOrder({ ...base, id: oid, photos: ['c.jpg'], items: [base.items[0]] } as any);
  const e = (await Repo.getOrder(oid))!;
  assert.equal(e.items.length, 1); assert.deepEqual(e.photos, ['c.jpg']); assert.equal(e.status, 'stitching'); assert.match(e.orderNumber, /-001$/); ok('order edit');

  // khata
  let sum = await Repo.customerSummary(head);
  assert.equal(sum.billed, 2900 + 4100); assert.equal(sum.paid, 1000); assert.equal(sum.balance, 6000);
  await Repo.addPayment({ customerId: head, orderId: oid2, amount: 500, date: todayStr(), method: 'online', note: '' });
  sum = await Repo.customerSummary(head); assert.equal(sum.balance, 5500);
  await Repo.setOrderStatus(oid2, 'cancelled');
  sum = await Repo.customerSummary(head); assert.equal(sum.billed, 2900); ok('khata summaries');

  // cash book
  await Repo.addExpense({ amount: 300, date: todayStr(), category: 'rent' });
  let cd = await Repo.cashDayData(todayStr());
  assert.equal(cd.cashIn, 1000); assert.equal(cd.onlineIn, 500); assert.equal(cd.out, 300); assert.equal(cd.opening, 0);
  await Repo.saveCashDay({ date: addDays(-1), opening: 0, closing: 777 });
  cd = await Repo.cashDayData(todayStr()); assert.equal(cd.opening, 777); ok('cash book opening carry-over');

  // stock
  const st = await Repo.saveStock({ name: 'White cotton', category: 'fabric', unit: 'meter', qty: 10, minQty: 5 });
  assert.equal((await Repo.lowStock()).length, 0);
  await Repo.adjustStock(st, -6, 'used');
  assert.equal((await Repo.lowStock()).length, 1); assert.equal((await Repo.stockLogFor(st)).length, 2); ok('stock + low stock');

  // reports
  const now = new Date(); const ms = await Repo.monthSummary(now.getFullYear(), now.getMonth());
  assert.equal(ms.income, 1500); assert.equal(ms.expenses, 300); assert.equal(ms.profit, 1200);
  const dash = await Repo.dashboardStats();
  assert.equal(dash.pendingCount, 1); assert.equal(dash.dueTodayCount, 1); assert.equal(dash.urgentCount, 1); assert.equal(dash.trialCount, 1);
  assert.equal(dash.lowStock.length, 1); assert.equal(dash.backupDue, true);
  assert.equal((await Repo.workload(14)).length, 1); ok('month summary, dashboard, workload');

  // backup round trip (export → wipe → import)
  const payload = JSON.parse(JSON.stringify(await exportAll(photoIO)));
  assert.equal(payload.app, 'DarziHub'); assert.equal(payload.data.orders.length, 2);
  assert.ok(payload.data.orders[0].photos[0].startsWith('data:'));
  await Repo.wipeAll();
  assert.equal((await Repo.listCustomers()).length, 0);
  const r = await importAll(payload, 'replace', photoIO);
  assert.equal(r.customers, 2); assert.equal(r.orders, 2);
  const o2 = (await Repo.getOrder(oid))!; assert.deepEqual(o2.photos, ['c.jpg']); assert.equal(o2.items.length, 1);
  assert.equal((await Repo.getCustomer(head))!.measurements!.qameez.values.length, '40');
  assert.equal((await Repo.getCustomer(wife))!.headId, head);
  assert.equal((await Repo.getSettings()).shopName, 'Test Shop');
  assert.equal((await Repo.customerSummary(head)).balance, 2900 - 1000 - 500 + 0);
  // merge again is idempotent
  await importAll(payload, 'merge', photoIO);
  assert.equal((await Repo.listOrders()).length, 2);
  ok('backup export/import round trip + idempotent merge');

  // delete order cleans children
  const files = await Repo.deleteOrder(oid);
  assert.deepEqual(files, ['c.jpg']);
  assert.equal((await getDb().getFirstAsync<any>('SELECT COUNT(*) n FROM order_items WHERE order_id = ?', [oid])).n, 0);
  assert.equal((await Repo.listPaymentsForOrder(oid)).length, 0); ok('order delete cascades');

  console.log(`\n${passed} test groups passed`);
}
main().catch((e) => { console.error('FAIL', e); process.exit(1); });
