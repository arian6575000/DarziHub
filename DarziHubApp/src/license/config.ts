// ====== PER-APP LICENSE SETTINGS ======
// PROJECT_CODE: same code as in the License Generator "Projects" list.
// PUBLIC_KEY_HEX: the Ed25519 PUBLIC key (64 hex chars) of the "darzihub" project
// (License Generator app -> Info/Keys tab, or Hub -> projects). Never put a private key here.
export const PROJECT_CODE = "darzihub";
export const PUBLIC_KEY_HEX = "PASTE_DARZIHUB_PUBLIC_KEY_HEX_HERE";
// =======================================
export const KEY_CONFIGURED = /^[0-9a-fA-F]{64}$/.test(PUBLIC_KEY_HEX);
