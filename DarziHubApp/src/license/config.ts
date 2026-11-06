// ====== PER-APP LICENSE SETTINGS ======
// PROJECT_CODE: same code as in the License Generator "Projects" list.
// PUBLIC_KEY_HEX: the Ed25519 PUBLIC key (64 hex chars) of the "darzihub" project. Never put a private key here.
export const PROJECT_CODE = "darzihub";
export const PUBLIC_KEY_HEX = "9c646b9a4b22ac15a5f1ef4084f9ab599bc9eec4b02c9efa4bba7c61572ff507";
// =======================================
export const KEY_CONFIGURED = /^[0-9a-fA-F]{64}$/.test(PUBLIC_KEY_HEX);
