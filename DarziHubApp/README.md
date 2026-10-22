# DarziHub — Expo (React Native) + SQLite

Offline tailor-shop manager (اردو / English). Port of the DarziHub PWA: all data lives in a local SQLite database on the phone, no server, no login.

## Run
```
npm install
npx expo start          # scan the QR with Expo Go (Android / iOS)
```
Build an installable APK/IPA: `npx eas-cli@latest build -p android --profile preview`.

## Features
Customers (+ family profiles), measurements per garment, orders (multi-item, photos, trial/delivery dates, urgent),
payments / khata, cash book, expenses, stock, monthly summary + CSV, receipts (thermal 80/58 mm, A4, measurement slip,
garment tags, fabric slip) with Print / PDF / WhatsApp, WhatsApp message templates, PIN lock, 9 AM delivery reminders,
backup & restore (JSON — compatible with backups from the web version).

## Structure
```
src/app/            expo-router screens ((tabs): home, orders, customers, accounts, settings)
src/db/             schema.ts (SQLite migrations) · repo.ts (all queries) · backupCore.ts
src/lib/            i18n, garments, receipt HTML, photos, lock, notifications
src/ui/ , src/ctx/  UI kit, app context (settings, language, toast)
tests/              `npm test` runs the data layer against a real SQLite engine
```
Schema changes: append a new SQL string to `MIGRATIONS` in `src/db/schema.ts` (tracked by `PRAGMA user_version`).
Urdu text uses the bundled Noto Nastaliq Urdu font (works offline).
