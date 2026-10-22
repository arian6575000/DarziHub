// DarziHub data layer — port of the PWA's Dexie `Repo` onto relational SQLite.
import type { Db } from './schema';
import { migrate } from './schema';
import {
  CashDay, Customer, CustomerSummary, Expense, MeasurementMap, Order, OrderItem, Payment, PENDING,
  Settings, DEFAULT_SETTINGS, StockItem, StockLog, Status,
} from './types';
import { addDays, monthRange, todayStr } from '../lib/dates';
import { calcOrder } from '../lib/calc';

let db: Db;
export async function initRepo(d: Db) { db = d; await migrate(d); }
export const getDb = () => db;

const bool = (v: any) => (v ? 1 : 0);
const num = (v: any) => Number(v) || 0;
const parseJson = <T,>(s: any, fallback: T): T => { try { return s ? JSON.parse(s) : fallback; } catch { return fallback; } };

// ---------- row mappers ----------
const toCustomer = (r: any): Customer => ({
  id: r.id, name: r.name, phone: r.phone || '', gender: r.gender || 'both', address: r.address || '',
  notes: r.notes || '', headId: r.head_id ?? null, createdAt: r.created_at,
});
const toPayment = (r: any): Payment => ({
  id: r.id, customerId: r.customer_id, orderId: r.order_id ?? null, amount: r.amount, date: r.date,
  method: r.method === 'online' ? 'online' : 'cash', note: r.note || '', createdAt: r.created_at,
});
const toExpense = (r: any): Expense => ({ id: r.id, date: r.date, category: r.category, amount: r.amount, note: r.note || '', createdAt: r.created_at });
const toStock = (r: any): StockItem => ({ id: r.id, name: r.name, category: r.category, unit: r.unit, qty: r.qty, minQty: r.min_qty, createdAt: r.created_at });
const toStockLog = (r: any): StockLog => ({ id: r.id, stockId: r.stock_id, date: r.date, delta: r.delta, note: r.note || '', createdAt: r.created_at });

function toOrder(r: any, items: OrderItem[], photos: string[]): Order {
  return {
    id: r.id, orderNumber: r.order_number, customerId: r.customer_id, status: r.status, orderDate: r.order_date,
    deliveryDate: r.delivery_date || '', trialDate: r.trial_date || '', urgent: !!r.urgent, discount: r.discount || 0,
    notes: r.notes || '', fabricReceived: r.fabric_received || '', fabricMeters: r.fabric_meters || 0,
    measurements: parseJson<MeasurementMap>(r.measurements, {}), deliveredAt: r.delivered_at || '',
    createdAt: r.created_at, updatedAt: r.updated_at, items, photos,
  };
}
const toItem = (r: any): OrderItem => ({ garment: r.garment, qty: r.qty, rate: r.rate, fabricAmount: r.fabric_amount, notes: r.notes || '' });

async function hydrateOrders(rows: any[]): Promise<Order[]> {
  if (!rows.length) return [];
  const [items, photos] = await Promise.all([
    db.getAllAsync<any>('SELECT * FROM order_items ORDER BY order_id, position, id'),
    db.getAllAsync<any>('SELECT * FROM order_photos ORDER BY order_id, position, id'),
  ]);
  const im = new Map<number, OrderItem[]>(); const pm = new Map<number, string[]>();
  items.forEach((i) => { if (!im.has(i.order_id)) im.set(i.order_id, []); im.get(i.order_id)!.push(toItem(i)); });
  photos.forEach((p) => { if (!pm.has(p.order_id)) pm.set(p.order_id, []); pm.get(p.order_id)!.push(p.file); });
  return rows.map((r) => toOrder(r, im.get(r.id) || [], pm.get(r.id) || []));
}

export const Repo = {
  // ---------------- Settings ----------------
  async getSettings(): Promise<Settings> {
    const row = await db.getFirstAsync<{ data: string }>('SELECT data FROM settings WHERE id = ?', ['main']);
    if (!row) { await db.runAsync('INSERT INTO settings (id, data) VALUES (?, ?)', ['main', JSON.stringify(DEFAULT_SETTINGS)]); return { ...DEFAULT_SETTINGS }; }
    return { ...DEFAULT_SETTINGS, ...parseJson<Partial<Settings>>(row.data, {}) };
  },
  async saveSettings(s: Settings): Promise<Settings> {
    await db.runAsync('INSERT OR REPLACE INTO settings (id, data) VALUES (?, ?)', ['main', JSON.stringify(s)]);
    return s;
  },

  // ---------------- Customers ----------------
  async listCustomers(): Promise<Customer[]> {
    return (await db.getAllAsync<any>('SELECT * FROM customers ORDER BY name COLLATE NOCASE')).map(toCustomer);
  },
  async customerMap(): Promise<Record<number, Customer>> {
    return Object.fromEntries((await Repo.listCustomers()).map((c) => [c.id, c]));
  },
  async getCustomer(id: number): Promise<Customer | null> {
    const r = await db.getFirstAsync<any>('SELECT * FROM customers WHERE id = ?', [id]);
    if (!r) return null;
    const c = toCustomer(r);
    const ms = await db.getAllAsync<any>('SELECT * FROM measurements WHERE customer_id = ?', [id]);
    c.measurements = {};
    ms.forEach((m) => { c.measurements![m.garment] = { values: parseJson(m.vals, {}), style: m.style || '', updatedAt: m.updated_at }; });
    return c;
  },
  async saveCustomer(d: Partial<Customer> & { name: string }): Promise<number> {
    const f = [d.name.trim(), d.phone || '', d.gender || 'both', d.address || '', d.notes || '', d.headId ?? null];
    if (d.id) {
      await db.runAsync('UPDATE customers SET name=?, phone=?, gender=?, address=?, notes=?, head_id=? WHERE id=?', [...f, d.id]);
      return d.id;
    }
    const r = await db.runAsync('INSERT INTO customers (name, phone, gender, address, notes, head_id, created_at) VALUES (?,?,?,?,?,?,?)', [...f, Date.now()]);
    return r.lastInsertRowId;
  },
  async listMembers(headId: number): Promise<Customer[]> {
    return (await db.getAllAsync<any>('SELECT * FROM customers WHERE head_id = ? ORDER BY name COLLATE NOCASE', [headId])).map(toCustomer);
  },
  async saveMeasurement(customerId: number, garment: string, values: Record<string, string | number>, style: string) {
    await db.runAsync(
      'INSERT OR REPLACE INTO measurements (customer_id, garment, vals, style, updated_at) VALUES (?,?,?,?,?)',
      [customerId, garment, JSON.stringify(values), style || '', Date.now()]);
  },
  /** Throws an Error with i18n key as message when the customer cannot be deleted. */
  async deleteCustomer(id: number) {
    const n = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM orders WHERE customer_id = ?', [id]);
    if ((n?.n || 0) > 0) throw new Error('customerHasOrders');
    if ((await Repo.listMembers(id)).length) throw new Error('customerHasMembers');
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM payments WHERE customer_id = ?', [id]);
      await db.runAsync('DELETE FROM customers WHERE id = ?', [id]);
    });
  },
  async customerSummaries(): Promise<Record<number, CustomerSummary>> {
    const [orders, payments] = await Promise.all([Repo.listOrders(), db.getAllAsync<any>('SELECT customer_id, SUM(amount) AS paid FROM payments GROUP BY customer_id')]);
    const map: Record<number, CustomerSummary> = {};
    const get = (id: number) => (map[id] = map[id] || { billed: 0, paid: 0, balance: 0, orderCount: 0 });
    orders.forEach((o) => { if (o.status === 'cancelled') return; const s = get(o.customerId); s.billed += calcOrder(o).total; s.orderCount++; });
    payments.forEach((p) => { get(p.customer_id).paid += num(p.paid); });
    Object.values(map).forEach((s) => { s.balance = s.billed - s.paid; });
    return map;
  },
  async customerSummary(id: number): Promise<CustomerSummary> {
    return (await Repo.customerSummaries())[id] || { billed: 0, paid: 0, balance: 0, orderCount: 0 };
  },

  // ---------------- Orders ----------------
  async listOrders(): Promise<Order[]> {
    return hydrateOrders(await db.getAllAsync<any>('SELECT * FROM orders ORDER BY created_at DESC, id DESC'));
  },
  async listOrdersForCustomer(cid: number): Promise<Order[]> {
    const all = await hydrateOrders(await db.getAllAsync<any>('SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC, id DESC', [cid]));
    return all;
  },
  async getOrder(id: number): Promise<Order | null> {
    const r = await db.getFirstAsync<any>('SELECT * FROM orders WHERE id = ?', [id]);
    if (!r) return null;
    const [items, photos] = await Promise.all([
      db.getAllAsync<any>('SELECT * FROM order_items WHERE order_id = ? ORDER BY position, id', [id]),
      db.getAllAsync<any>('SELECT * FROM order_photos WHERE order_id = ? ORDER BY position, id', [id]),
    ]);
    return toOrder(r, items.map(toItem), photos.map((p) => p.file));
  },
  async nextOrderNumber(): Promise<string> {
    const s = await Repo.getSettings();
    const y = new Date().getFullYear();
    const pre = `${s.orderPrefix || 'ORD'}-${y}-`;
    const rows = await db.getAllAsync<{ order_number: string }>('SELECT order_number FROM orders WHERE order_number LIKE ?', [pre.replace(/[%_]/g, '') + '%']);
    const nums = rows.map((r) => r.order_number).filter((n) => n && n.startsWith(pre))
      .map((n) => parseInt(n.slice(pre.length), 10)).filter((n) => !isNaN(n));
    return pre + String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, '0');
  },
  /** Create or update an order (with items + photos). `advance` is recorded as a payment on create. */
  async saveOrder(d: Omit<Order, 'id' | 'orderNumber' | 'status' | 'createdAt' | 'updatedAt' | 'deliveredAt'> & { id?: number; orderNumber?: string; status?: Status }, advance = 0): Promise<number> {
    const now = Date.now();
    let id = d.id || 0;
    const orderNumber = d.id ? undefined : (d.orderNumber || await Repo.nextOrderNumber());
    await db.withTransactionAsync(async () => {
      const common = [d.customerId, d.orderDate, d.deliveryDate || '', d.trialDate || '', bool(d.urgent), num(d.discount), d.notes || '',
        d.fabricReceived || '', num(d.fabricMeters), JSON.stringify(d.measurements || {})];
      if (d.id) {
        await db.runAsync(
          `UPDATE orders SET customer_id=?, order_date=?, delivery_date=?, trial_date=?, urgent=?, discount=?, notes=?,
           fabric_received=?, fabric_meters=?, measurements=?, updated_at=? WHERE id=?`, [...common, now, d.id]);
        await db.runAsync('DELETE FROM order_items WHERE order_id = ?', [d.id]);
        await db.runAsync('DELETE FROM order_photos WHERE order_id = ?', [d.id]);
      } else {
        const r = await db.runAsync(
          `INSERT INTO orders (customer_id, order_date, delivery_date, trial_date, urgent, discount, notes, fabric_received,
           fabric_meters, measurements, order_number, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [...common, orderNumber, d.status || 'new', now, now]);
        id = r.lastInsertRowId;
      }
      for (let i = 0; i < d.items.length; i++) {
        const it = d.items[i];
        await db.runAsync('INSERT INTO order_items (order_id, position, garment, qty, rate, fabric_amount, notes) VALUES (?,?,?,?,?,?,?)',
          [id, i, it.garment, num(it.qty), num(it.rate), num(it.fabricAmount), it.notes || '']);
      }
      for (let i = 0; i < (d.photos || []).length; i++) {
        await db.runAsync('INSERT INTO order_photos (order_id, position, file) VALUES (?,?,?)', [id, i, d.photos[i]]);
      }
      if (!d.id && advance > 0) {
        await db.runAsync('INSERT INTO payments (customer_id, order_id, amount, date, method, note, created_at) VALUES (?,?,?,?,?,?,?)',
          [d.customerId, id, advance, todayStr(), 'cash', 'advance', now]);
      }
    });
    return id;
  },
  async setOrderStatus(id: number, status: Status) {
    if (status === 'delivered') await db.runAsync('UPDATE orders SET status=?, updated_at=?, delivered_at=? WHERE id=?', [status, Date.now(), todayStr(), id]);
    else await db.runAsync('UPDATE orders SET status=?, updated_at=? WHERE id=?', [status, Date.now(), id]);
  },
  /** Returns the photo file names that belonged to the order so the caller can delete them from disk. */
  async deleteOrder(id: number): Promise<string[]> {
    const photos = (await db.getAllAsync<any>('SELECT file FROM order_photos WHERE order_id = ?', [id])).map((p) => p.file as string);
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM payments WHERE order_id = ?', [id]);
      await db.runAsync('DELETE FROM orders WHERE id = ?', [id]);
    });
    return photos;
  },
  async orderPaid(id: number): Promise<number> {
    const r = await db.getFirstAsync<{ s: number }>('SELECT COALESCE(SUM(amount),0) AS s FROM payments WHERE order_id = ?', [id]);
    return r?.s || 0;
  },

  // ---------------- Payments ----------------
  async listPaymentsForOrder(id: number): Promise<Payment[]> {
    return (await db.getAllAsync<any>('SELECT * FROM payments WHERE order_id = ? ORDER BY date DESC, created_at DESC', [id])).map(toPayment);
  },
  async listPaymentsForCustomer(id: number): Promise<Payment[]> {
    return (await db.getAllAsync<any>('SELECT * FROM payments WHERE customer_id = ? ORDER BY created_at DESC', [id])).map(toPayment);
  },
  async addPayment(p: { customerId: number; orderId?: number | null; amount: number; date: string; method: 'cash' | 'online'; note?: string }) {
    const r = await db.runAsync('INSERT INTO payments (customer_id, order_id, amount, date, method, note, created_at) VALUES (?,?,?,?,?,?,?)',
      [p.customerId, p.orderId || null, p.amount, p.date, p.method, p.note || '', Date.now()]);
    return r.lastInsertRowId;
  },
  async deletePayment(id: number) { await db.runAsync('DELETE FROM payments WHERE id = ?', [id]); },

  // ---------------- Expenses ----------------
  async listExpenses(y: number, m: number): Promise<Expense[]> {
    const [a, b] = monthRange(y, m);
    return (await db.getAllAsync<any>('SELECT * FROM expenses WHERE date BETWEEN ? AND ? ORDER BY date DESC, created_at DESC', [a, b])).map(toExpense);
  },
  async addExpense(e: { amount: number; date: string; category: string; note?: string }) {
    const r = await db.runAsync('INSERT INTO expenses (date, category, amount, note, created_at) VALUES (?,?,?,?,?)', [e.date, e.category, e.amount, e.note || '', Date.now()]);
    return r.lastInsertRowId;
  },
  async deleteExpense(id: number) { await db.runAsync('DELETE FROM expenses WHERE id = ?', [id]); },

  // ---------------- Reports ----------------
  async monthSummary(y: number, m: number) {
    const [a, b] = monthRange(y, m);
    const [inc, exp, ord] = await Promise.all([
      db.getFirstAsync<{ s: number }>('SELECT COALESCE(SUM(amount),0) AS s FROM payments WHERE date BETWEEN ? AND ?', [a, b]),
      db.getFirstAsync<{ s: number }>('SELECT COALESCE(SUM(amount),0) AS s FROM expenses WHERE date BETWEEN ? AND ?', [a, b]),
      db.getAllAsync<any>('SELECT * FROM orders WHERE order_date BETWEEN ? AND ?', [a, b]),
    ]);
    const live = (await hydrateOrders(ord)).filter((o) => o.status !== 'cancelled');
    const garments: Record<string, number> = {};
    live.forEach((o) => o.items.forEach((i) => { garments[i.garment] = (garments[i.garment] || 0) + num(i.qty); }));
    const income = inc?.s || 0, expenses = exp?.s || 0;
    return {
      income, expenses, profit: income - expenses, orders: live.length,
      delivered: live.filter((o) => o.status === 'delivered').length,
      billed: live.reduce((s, o) => s + calcOrder(o).total, 0),
      garments: Object.entries(garments).sort((x, z) => z[1] - x[1]) as [string, number][],
    };
  },

  async dashboardStats() {
    const [orders, sums, settings, lowStock] = await Promise.all([Repo.listOrders(), Repo.customerSummaries(), Repo.getSettings(), Repo.lowStock()]);
    const now = new Date();
    const month = await Repo.monthSummary(now.getFullYear(), now.getMonth());
    const today = todayStr(), tomorrow = addDays(1);
    const pending = orders.filter((o) => PENDING.includes(o.status));
    const upcoming = pending.slice().sort((a, b) => (a.deliveryDate || '9999').localeCompare(b.deliveryDate || '9999')).slice(0, 6);
    const cust = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM customers');
    return {
      dueTodayCount: pending.filter((o) => o.deliveryDate === today).length,
      dueTomorrowCount: pending.filter((o) => o.deliveryDate === tomorrow).length,
      trialCount: pending.filter((o) => o.trialDate === today || o.trialDate === tomorrow).length,
      urgentCount: pending.filter((o) => o.urgent).length,
      lowStock,
      backupDue: (cust?.n || 0) > 0 && Date.now() - (settings.lastBackupAt || 0) > 7 * 86400000,
      pendingCount: pending.length,
      readyCount: orders.filter((o) => o.status === 'ready').length,
      dueCount: pending.filter((o) => o.deliveryDate && o.deliveryDate <= today).length,
      receivable: Object.values(sums).reduce((s, x) => s + Math.max(0, x.balance), 0),
      month, upcoming,
    };
  },

  // ---------------- Stock ----------------
  async listStock(): Promise<StockItem[]> { return (await db.getAllAsync<any>('SELECT * FROM stock ORDER BY name COLLATE NOCASE')).map(toStock); },
  async getStock(id: number): Promise<StockItem | null> {
    const r = await db.getFirstAsync<any>('SELECT * FROM stock WHERE id = ?', [id]); return r ? toStock(r) : null;
  },
  async saveStock(i: { id?: number; name: string; category: string; unit: string; qty?: number | string; minQty?: number | string }): Promise<number> {
    const minQty = num(i.minQty);
    if (i.id) {
      await db.runAsync('UPDATE stock SET name=?, category=?, unit=?, min_qty=? WHERE id=?', [i.name, i.category, i.unit, minQty, i.id]);
      return i.id;
    }
    const qty = num(i.qty);
    const r = await db.runAsync('INSERT INTO stock (name, category, unit, qty, min_qty, created_at) VALUES (?,?,?,?,?,?)', [i.name, i.category, i.unit, qty, minQty, Date.now()]);
    if (qty) await db.runAsync('INSERT INTO stock_log (stock_id, date, delta, note, created_at) VALUES (?,?,?,?,?)', [r.lastInsertRowId, todayStr(), qty, 'opening', Date.now()]);
    return r.lastInsertRowId;
  },
  async adjustStock(id: number, delta: number, note?: string) {
    await db.withTransactionAsync(async () => {
      await db.runAsync('UPDATE stock SET qty = qty + ? WHERE id = ?', [delta, id]);
      await db.runAsync('INSERT INTO stock_log (stock_id, date, delta, note, created_at) VALUES (?,?,?,?,?)', [id, todayStr(), delta, note || '', Date.now()]);
    });
  },
  async deleteStock(id: number) { await db.runAsync('DELETE FROM stock WHERE id = ?', [id]); },
  async stockLogFor(id: number): Promise<StockLog[]> {
    return (await db.getAllAsync<any>('SELECT * FROM stock_log WHERE stock_id = ? ORDER BY created_at DESC, id DESC LIMIT 15', [id])).map(toStockLog);
  },
  async lowStock(): Promise<StockItem[]> {
    return (await db.getAllAsync<any>('SELECT * FROM stock WHERE min_qty > 0 AND qty <= min_qty ORDER BY name COLLATE NOCASE')).map(toStock);
  },

  // ---------------- Cash book (roznamcha) ----------------
  async cashDayData(date: string) {
    const [pay, exp, day, prev] = await Promise.all([
      db.getAllAsync<any>('SELECT * FROM payments WHERE date = ? ORDER BY created_at', [date]),
      db.getAllAsync<any>('SELECT * FROM expenses WHERE date = ? ORDER BY created_at', [date]),
      db.getFirstAsync<any>('SELECT * FROM cash_day WHERE date = ?', [date]),
      db.getFirstAsync<any>('SELECT * FROM cash_day WHERE date < ? AND closing IS NOT NULL ORDER BY date DESC LIMIT 1', [date]),
    ]);
    const payments = pay.map(toPayment), expenses = exp.map(toExpense);
    const cashIn = payments.filter((p) => p.method !== 'online').reduce((s, p) => s + p.amount, 0);
    const onlineIn = payments.filter((p) => p.method === 'online').reduce((s, p) => s + p.amount, 0);
    const out = expenses.reduce((s, e) => s + e.amount, 0);
    return {
      payments, expenses, cashIn, onlineIn, out,
      opening: day && day.opening != null ? Number(day.opening) : (prev ? Number(prev.closing) : 0),
      closing: day ? (day.closing as number | null) : null,
    };
  },
  async saveCashDay(row: CashDay) {
    await db.runAsync('INSERT OR REPLACE INTO cash_day (date, opening, closing) VALUES (?,?,?)', [row.date, row.opening, row.closing]);
  },

  // ---------------- Workload & monthly export ----------------
  async workload(days = 14) {
    const today = todayStr(), end = addDays(days - 1);
    const rows = await hydrateOrders(await db.getAllAsync<any>(
      `SELECT * FROM orders WHERE status IN ('new','cutting','stitching','ready') AND delivery_date >= ? AND delivery_date <= ? AND delivery_date <> ''`, [today, end]));
    const map: Record<string, { date: string; orders: number; pieces: number }> = {};
    rows.forEach((o) => {
      const m = (map[o.deliveryDate] = map[o.deliveryDate] || { date: o.deliveryDate, orders: 0, pieces: 0 });
      m.orders++; m.pieces += o.items.reduce((s, i) => s + num(i.qty), 0);
    });
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  },
  async monthData(y: number, m: number) {
    const [a, b] = monthRange(y, m);
    const [ordRows, pay, exp, customers] = await Promise.all([
      db.getAllAsync<any>('SELECT * FROM orders WHERE order_date BETWEEN ? AND ?', [a, b]),
      db.getAllAsync<any>('SELECT * FROM payments WHERE date BETWEEN ? AND ?', [a, b]),
      db.getAllAsync<any>('SELECT * FROM expenses WHERE date BETWEEN ? AND ?', [a, b]),
      Repo.customerMap(),
    ]);
    return { orders: await hydrateOrders(ordRows), payments: pay.map(toPayment), expenses: exp.map(toExpense), customers };
  },
  async markBackup() { const s = await Repo.getSettings(); s.lastBackupAt = Date.now(); await Repo.saveSettings(s); },

  /** Every photo file name referenced by any order (used to clean orphaned files). */
  async allPhotoFiles(): Promise<string[]> {
    return (await db.getAllAsync<any>('SELECT file FROM order_photos')).map((p) => p.file);
  },

  async wipeAll() {
    await db.withTransactionAsync(async () => {
      for (const t of ['stock_log', 'stock', 'cash_day', 'payments', 'expenses', 'order_photos', 'order_items', 'orders', 'measurements', 'customers', 'settings']) {
        await db.runAsync(`DELETE FROM ${t}`);
      }
    });
  },
};
export { calcOrder };
