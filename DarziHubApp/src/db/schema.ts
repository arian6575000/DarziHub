// SQLite schema + migrations (tracked with PRAGMA user_version).
// Anything that talks to SQLite goes through the small `Db` interface so the
// same code can run on expo-sqlite (app) and node:sqlite (tests).

export interface Db {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: any[]): Promise<{ lastInsertRowId: number; changes: number }>;
  getAllAsync<T>(sql: string, params?: any[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params?: any[]): Promise<T | null>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

const MIGRATIONS: string[] = [
  // v1 — initial schema
  `
  CREATE TABLE settings (id TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL);

  CREATE TABLE customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    gender TEXT NOT NULL DEFAULT 'both',
    address TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    head_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX idx_customers_name ON customers(name COLLATE NOCASE);
  CREATE INDEX idx_customers_head ON customers(head_id);

  CREATE TABLE measurements (
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    garment TEXT NOT NULL,
    vals TEXT NOT NULL DEFAULT '{}',
    style TEXT NOT NULL DEFAULT '',
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (customer_id, garment)
  );

  CREATE TABLE orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT NOT NULL,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    status TEXT NOT NULL DEFAULT 'new',
    order_date TEXT NOT NULL,
    delivery_date TEXT NOT NULL DEFAULT '',
    trial_date TEXT NOT NULL DEFAULT '',
    urgent INTEGER NOT NULL DEFAULT 0,
    discount REAL NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    fabric_received TEXT NOT NULL DEFAULT '',
    fabric_meters REAL NOT NULL DEFAULT 0,
    measurements TEXT NOT NULL DEFAULT '{}',
    delivered_at TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX idx_orders_customer ON orders(customer_id);
  CREATE INDEX idx_orders_status ON orders(status);
  CREATE INDEX idx_orders_delivery ON orders(delivery_date);
  CREATE INDEX idx_orders_date ON orders(order_date);
  CREATE UNIQUE INDEX idx_orders_number ON orders(order_number);

  CREATE TABLE order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    position INTEGER NOT NULL DEFAULT 0,
    garment TEXT NOT NULL,
    qty REAL NOT NULL DEFAULT 1,
    rate REAL NOT NULL DEFAULT 0,
    fabric_amount REAL NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX idx_items_order ON order_items(order_id);

  CREATE TABLE order_photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    position INTEGER NOT NULL DEFAULT 0,
    file TEXT NOT NULL
  );
  CREATE INDEX idx_photos_order ON order_photos(order_id);

  CREATE TABLE payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    amount REAL NOT NULL,
    date TEXT NOT NULL,
    method TEXT NOT NULL DEFAULT 'cash',
    note TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
  );
  CREATE INDEX idx_payments_customer ON payments(customer_id);
  CREATE INDEX idx_payments_order ON payments(order_id);
  CREATE INDEX idx_payments_date ON payments(date);

  CREATE TABLE expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'other',
    amount REAL NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
  );
  CREATE INDEX idx_expenses_date ON expenses(date);

  CREATE TABLE stock (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'fabric',
    unit TEXT NOT NULL DEFAULT 'meter',
    qty REAL NOT NULL DEFAULT 0,
    min_qty REAL NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE stock_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stock_id INTEGER NOT NULL REFERENCES stock(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    delta REAL NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
  );
  CREATE INDEX idx_stocklog_stock ON stock_log(stock_id);

  CREATE TABLE cash_day (
    date TEXT PRIMARY KEY NOT NULL,
    opening REAL NOT NULL DEFAULT 0,
    closing REAL
  );
  `,
];

export async function migrate(db: Db): Promise<void> {
  await db.execAsync('PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let v = row?.user_version ?? 0;
  while (v < MIGRATIONS.length) {
    const sql = MIGRATIONS[v];
    await db.withTransactionAsync(async () => {
      await db.execAsync(sql);
      await db.execAsync(`PRAGMA user_version = ${v + 1};`);
    });
    v++;
  }
}
