// ====== PER-APP LICENSE SETTINGS ======
// PROJECT_CODE: same code as in the License Generator "Projects" list.
// PUBLIC_KEY_HEX: the Ed25519 PUBLIC key (64 hex chars) of the "darzihub" project. Never put a private key here.
export const PROJECT_CODE = "darzihub";
export const PUBLIC_KEY_HEX = "9c646b9a4b22ac15a5f1ef4084f9ab599bc9eec4b02c9efa4bba7c61572ff507";
// =======================================
// DEVICE_PREFIX: app name at the start of the Device ID ("DarziHub-87A9-F285-E2DF"); unique per app so licenses never cross apps.
export const DEVICE_PREFIX = "DarziHub";
// DarziHub already issued licenses bound to the old 20-hex ID: keep accepting them. (Set false once all customers have new licenses.)
export const ACCEPT_LEGACY_DEVICE_ID = true;
export const KEY_CONFIGURED = /^[0-9a-fA-F]{64}$/.test(PUBLIC_KEY_HEX);
