# DarziHub v1.1.0 – License + Security + UI fixes

## 1. License (offline, Ed25519)
- Files: `src/license/{config,licenseCore,deviceId,licenseClient,LicenseGate}.ts(x)`; root layout wraps the Stack in `<LicenseGate>`.
- **ZAROORI:** `src/license/config.ts` mein `PUBLIC_KEY_HEX` ki jagah darzihub project ki Ed25519 *public* key (64 hex) paste karein
  (Generator app / Hub se). Jab tak paste na ho, app "build mein license key nahi" dikhayegi (fail-closed).
- Generator mein project code `darzihub` hona chahiye (non-legacy: license mein `project_code` + `license_id` hota hai; bina project_code wali license reject).
- Device ID = hash(Android ID + model) -> `XXXX-XXXX-XXXX-XXXX-XXXX`. License device-bound hai; naye phone ko nayi license.
- Clock rollback guard (`mpos_lastseen`), 3 din pehle expiry warning, foreground par dobara check.
- `useLicense()` se plan/features/daysLeft; `can(payload,'feature')`.

## 2. Security
- PIN: salted + stretched hash (Keystore), purana SHA-256 hash pehli successful entry par auto-upgrade. 5 ghalat PIN ke baad lockout (30s, double hota hai, max 1 ghanta) – app band karne se reset nahi hota.
- Biometric unlock (Settings > PIN set hone par).
- Screenshots / screen recording block + recent-apps thumbnail blank (FLAG_SECURE).
- `allowBackup=false` (Android auto-backup se database leak nahi), extra permissions blocked.
- License aur PIN SecureStore (Keystore, device-only) mein.
- Backup: password-protected (XSalsa20-Poly1305) option; share ke baad cache file delete; import ki cache copy delete.
- Receipt WebView: JS band, file access band, navigation block. Phone links sanitized.

## 3. UI "peeche boxes" fix
Sabab: Android par translucent background (`rgba(255,255,255,.86)`) + `elevation` => shadow ka grey box card/button ke peeche/andar nazar aata tha; pressed par `opacity` bhi wahi flash karta tha.
Fix: cards/icon buttons/tab bar/toast opaque, elevation sirf opaque views par (2), pressed state opacity ki jagah ripple/background.

## Notes
- Release APK abhi debug keystore se sign hota hai (expo prebuild default). Play Store / long-term ke liye apna keystore banayein.
- `npm install --legacy-peer-deps` (workflow pehle se karta hai).

## v1.2.0
- **Shop type** (Settings > Shop type): Gents / Ladies / Both. Sirf ek type ho to customer form mein type ka selector nahi aata, order mein sirf usi type ke garments, default rates mein sirf usi ke garments, customer detail/measurements mein sirf usi ke. Pehle ke orders ke garments edit mein nazar aate rahte hain. Shop type "Both" ho to customer ki apni type ke hisab se filter hota hai.
- **Company credit** "RetailX Solution · 03286575000": dashboard, settings, lock screen, activation screen, har receipt/slip/tag/fabric slip (preview, print, PDF), monthly CSV, aur backup file mein.

## v1.3.0 – Project registration + permissions
**Flow (har naye project ke liye ek jaisa):**
1. `src/license/permissions.json` = is app ki permissions ka source (project info + `permission_schema` + defaults). App mein naya feature lagao to pehle yahan add karo, phir `can('key')` use karo.
2. `npm install` ke baad `npm run license:project` chalao. Ye:
   - pehli baar Ed25519 keypair banata hai -> `.license/darzihub.keys.json` (git-ignored, **backup lo, kisi ko mat do**),
   - `.license/darzihub.project.json` banata hai = Hub ke `POST /api/v1/admin/projects` ka tayyar JSON (name, code, platform, keys, permission_schema, default_features),
   - **sirf public key** `src/license/config.ts` mein likh deta hai.
3. Hub dashboard > Projects > Add project mein us JSON ki fields paste karo (ya API se POST). Hub project ko pehchan leta hai; Generator sync ke baad is project ke licenses banata hai, features toggle ke saath.
4. APK dobara build karo (public key ab config mein hai).

**App mein enforcement** (`useCan()`): accounts.khata / accounts.expenses / accounts.reports (Accounts tab ke hisse), stock.manage, print.receipts (Print/PDF buttons), backup.export (Backup screen + cards). License mein jo key na ho, uska default permissions.json se aata hai; license mein `false` ho to feature band.
