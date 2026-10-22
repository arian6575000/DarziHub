// Backup / restore. The JSON format is identical to the DarziHub PWA backup
// ({app, version, data:{customers, orders, ...}}), so backups move both ways.
import { getDb, Repo } from './repo';
import { DEFAULT_SETTINGS } from './types';

export interface PhotoIO {
  /** file name -> data URL (null if the file is missing) */
  toDataUrl(file: string): Promise<string | null>;
  /** data URL -> stored file name */
  fromDataUrl(dataUrl: string): Promise<string>;
}

const n = (v: any) => Number(v) || 0;
const s = (v: any) => (v == null ? '' : String(v));

export async function exportAll(photos: PhotoIO) {
  const db = getDb();
  const [cust, ms, ord, items, ph, pay, exp, stock, slog, cash, settings] = await Promise.all([
    db.getAllAsync<any>('SELECT * FROM customers ORDER BY id'),
    db.getAllAsync<any>('SELECT * FROM measurements'),
    db.getAllAsync<any>('SELECT * FROM orders ORDER BY id'),
    db.getAllAsync<any>('SELECT * FROM order_items ORDER BY order_id, position, id'),
    db.getAllAsync<any>('SELECT * FROM order_photos ORDER BY order_id, position, id'),
    db.getAllAsync<any>('SELECT * FROM payments ORDER BY id'),
    db.getAllAsync<any>('SELECT * FROM expenses ORDER BY id'),
    db.getAllAsync<any>('SELECT * FROM stock ORDER BY id'),
    db.getAllAsync<any>('SELECT * FROM stock_log ORDER BY id'),
    db.getAllAsync<any>('SELECT * FROM cash_day ORDER BY date'),
    Repo.getSettings(),
  ]);
  const customers = cust.map((c) => {
    const measurements: Record<string, any> = {};
    ms.filter((m) => m.customer_id === c.id).forEach((m) => {
      let values = {}; try { values = JSON.parse(m.vals || '{}'); } catch { /* ignore */ }
      measurements[m.garment] = { values, style: m.style || '', updatedAt: m.updated_at };
    });
    const out: any = { id: c.id, name: c.name, phone: c.phone, gender: c.gender, address: c.address, notes: c.notes, createdAt: c.created_at, measurements };
    if (c.head_id) out.headId = c.head_id;
    return out;
  });
  const orders: any[] = [];
  for (const o of ord) {
    const photoUrls: string[] = [];
    for (const p of ph.filter((x) => x.order_id === o.id)) {
      const u = await photos.toDataUrl(p.file); if (u) photoUrls.push(u);
    }
    let measurements = {}; try { measurements = JSON.parse(o.measurements || '{}'); } catch { /* ignore */ }
    orders.push({
      id: o.id, orderNumber: o.order_number, customerId: o.customer_id, status: o.status, orderDate: o.order_date,
      deliveryDate: o.delivery_date, trialDate: o.trial_date, urgent: !!o.urgent, discount: o.discount, notes: o.notes,
      fabricReceived: o.fabric_received, fabricMeters: o.fabric_meters, measurements, photos: photoUrls,
      ...(o.delivered_at ? { deliveredAt: o.delivered_at } : {}), createdAt: o.created_at, updatedAt: o.updated_at,
      items: items.filter((i) => i.order_id === o.id).map((i) => ({ garment: i.garment, qty: i.qty, rate: i.rate, fabricAmount: i.fabric_amount, notes: i.notes })),
    });
  }
  return {
    app: 'DarziHub', version: 2, source: 'native', exportedAt: new Date().toISOString(),
    data: {
      customers, orders,
      payments: pay.map((p) => ({ id: p.id, customerId: p.customer_id, orderId: p.order_id, amount: p.amount, date: p.date, method: p.method, note: p.note, createdAt: p.created_at })),
      expenses: exp.map((e) => ({ id: e.id, date: e.date, category: e.category, amount: e.amount, note: e.note, createdAt: e.created_at })),
      settings: [{ id: 'main', ...settings, logo: settings.logo }],
      stock: stock.map((x) => ({ id: x.id, name: x.name, category: x.category, unit: x.unit, qty: x.qty, minQty: x.min_qty, createdAt: x.created_at })),
      stockLog: slog.map((l) => ({ id: l.id, stockId: l.stock_id, date: l.date, delta: l.delta, note: l.note, createdAt: l.created_at })),
      cashDay: cash.map((c) => ({ date: c.date, opening: c.opening, closing: c.closing })),
    },
  };
}

export function validateBackup(payload: any): boolean {
  return !!payload && typeof payload === 'object' && !!payload.data && typeof payload.data === 'object';
}

export async function importAll(payload: any, mode: 'merge' | 'replace', photos: PhotoIO) {
  if (!validateBackup(payload)) throw new Error('invalidBackup');
  const d = payload.data;
  const customers: any[] = d.customers || [], orders: any[] = d.orders || [], payments: any[] = d.payments || [],
    expenses: any[] = d.expenses || [], settings: any[] = d.settings || [], stock: any[] = d.stock || [],
    stockLog: any[] = d.stockLog || [], cashDay: any[] = d.cashDay || [];
  const db = getDb();

  // Decode photos first (file IO) so the SQL transaction stays short.
  const photoFiles = new Map<any, string[]>();
  for (const o of orders) {
    const files: string[] = [];
    for (const p of o.photos || []) {
      if (typeof p === 'string' && p.startsWith('data:')) { try { files.push(await photos.fromDataUrl(p)); } catch { /* skip bad photo */ } }
    }
    photoFiles.set(o, files);
  }

  const now = Date.now();
  await db.withTransactionAsync(async () => {
    await db.execAsync('PRAGMA defer_foreign_keys = ON;');
    if (mode === 'replace') {
      for (const t of ['stock_log', 'stock', 'cash_day', 'payments', 'expenses', 'order_photos', 'order_items', 'orders', 'measurements', 'customers']) {
        await db.runAsync(`DELETE FROM ${t}`);
      }
    }
    for (const c of customers) {
      await db.runAsync(
        `INSERT INTO customers (id, name, phone, gender, address, notes, head_id, created_at) VALUES (?,?,?,?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name, phone=excluded.phone, gender=excluded.gender, address=excluded.address,
         notes=excluded.notes, head_id=excluded.head_id, created_at=excluded.created_at`,
        [n(c.id), s(c.name) || '—', s(c.phone), c.gender === 'gents' || c.gender === 'ladies' ? c.gender : 'both', s(c.address), s(c.notes), c.headId ? n(c.headId) : null, n(c.createdAt) || now]);
      await db.runAsync('DELETE FROM measurements WHERE customer_id = ?', [n(c.id)]);
      for (const [g, m] of Object.entries<any>(c.measurements || {})) {
        await db.runAsync('INSERT INTO measurements (customer_id, garment, vals, style, updated_at) VALUES (?,?,?,?,?)',
          [n(c.id), g, JSON.stringify(m?.values || {}), s(m?.style), n(m?.updatedAt) || now]);
      }
    }
    for (const o of orders) {
      const id = n(o.id);
      let number = s(o.orderNumber) || `ORD-${id}`;
      const clash = await db.getFirstAsync<{ id: number }>('SELECT id FROM orders WHERE order_number = ? AND id <> ?', [number, id]);
      if (clash) number = `${number}-${id}`;
      await db.runAsync(
        `INSERT INTO orders (id, order_number, customer_id, status, order_date, delivery_date, trial_date, urgent, discount, notes,
           fabric_received, fabric_meters, measurements, delivered_at, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET order_number=excluded.order_number, customer_id=excluded.customer_id, status=excluded.status,
           order_date=excluded.order_date, delivery_date=excluded.delivery_date, trial_date=excluded.trial_date, urgent=excluded.urgent,
           discount=excluded.discount, notes=excluded.notes, fabric_received=excluded.fabric_received, fabric_meters=excluded.fabric_meters,
           measurements=excluded.measurements, delivered_at=excluded.delivered_at, created_at=excluded.created_at, updated_at=excluded.updated_at`,
        [id, number, n(o.customerId), s(o.status) || 'new', s(o.orderDate) || s(o.createdAt && new Date(o.createdAt).toISOString().slice(0, 10)),
          s(o.deliveryDate), s(o.trialDate), o.urgent ? 1 : 0, n(o.discount), s(o.notes), s(o.fabricReceived), n(o.fabricMeters),
          JSON.stringify(o.measurements || {}), s(o.deliveredAt), n(o.createdAt) || now, n(o.updatedAt) || now]);
      await db.runAsync('DELETE FROM order_items WHERE order_id = ?', [id]);
      await db.runAsync('DELETE FROM order_photos WHERE order_id = ?', [id]);
      let pos = 0;
      for (const it of o.items || []) {
        await db.runAsync('INSERT INTO order_items (order_id, position, garment, qty, rate, fabric_amount, notes) VALUES (?,?,?,?,?,?,?)',
          [id, pos++, s(it.garment) || 'other', n(it.qty) || 1, n(it.rate), n(it.fabricAmount), s(it.notes)]);
      }
      pos = 0;
      for (const f of photoFiles.get(o) || []) await db.runAsync('INSERT INTO order_photos (order_id, position, file) VALUES (?,?,?)', [id, pos++, f]);
    }
    for (const p of payments) {
      await db.runAsync(
        'INSERT OR REPLACE INTO payments (id, customer_id, order_id, amount, date, method, note, created_at) VALUES (?,?,?,?,?,?,?,?)',
        [n(p.id), n(p.customerId), p.orderId ? n(p.orderId) : null, n(p.amount), s(p.date), p.method === 'online' ? 'online' : 'cash', s(p.note), n(p.createdAt) || now]);
    }
    for (const e of expenses) {
      await db.runAsync('INSERT OR REPLACE INTO expenses (id, date, category, amount, note, created_at) VALUES (?,?,?,?,?,?)',
        [n(e.id), s(e.date), s(e.category) || 'other', n(e.amount), s(e.note), n(e.createdAt) || now]);
    }
    for (const x of stock) {
      await db.runAsync(
        `INSERT INTO stock (id, name, category, unit, qty, min_qty, created_at) VALUES (?,?,?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name, category=excluded.category, unit=excluded.unit, qty=excluded.qty, min_qty=excluded.min_qty, created_at=excluded.created_at`,
        [n(x.id), s(x.name), s(x.category) || 'other', s(x.unit) || 'piece', n(x.qty), n(x.minQty), n(x.createdAt) || now]);
    }
    for (const l of stockLog) {
      await db.runAsync('INSERT OR REPLACE INTO stock_log (id, stock_id, date, delta, note, created_at) VALUES (?,?,?,?,?,?)',
        [n(l.id), n(l.stockId), s(l.date), n(l.delta), s(l.note), n(l.createdAt) || now]);
    }
    for (const c of cashDay) {
      await db.runAsync('INSERT OR REPLACE INTO cash_day (date, opening, closing) VALUES (?,?,?)',
        [s(c.date), n(c.opening), c.closing == null || c.closing === '' ? null : n(c.closing)]);
    }
    if (settings.length) {
      const { id: _id, lastNotifyDay: _l, updatedAt: _u, ...rest } = settings[0];
      await db.runAsync('INSERT OR REPLACE INTO settings (id, data) VALUES (?, ?)', ['main', JSON.stringify({ ...DEFAULT_SETTINGS, ...rest })]);
    }
  });
  return { customers: customers.length, orders: orders.length };
}
