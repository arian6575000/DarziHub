// RetailX License Hub client: activate, heartbeat, kill switch. Best effort and fail-open: network problems never lock the app.
import * as SecureStore from "expo-secure-store";
import * as Application from "expo-application";
import { HUB_URL, PROJECT_CODE } from "./config";
import { HubVerdict, interpretHubReply, shouldSync } from "./hubCore";

const K_BLOCK = "mpos_hub_block";
const K_SYNC = "mpos_hub_sync";
const opts = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const API = () => `${HUB_URL.replace(/\/+$/, "")}/api/v1/license`;

async function call(method: "GET" | "POST", path: string, body?: object): Promise<{ http: number; json: unknown } | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const res = await fetch(API() + path, {
      method, signal: ctl.signal,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    let json: unknown = null;
    try { json = await res.json(); } catch { /* not JSON */ }
    return { http: res.status, json };
  } catch { return null; } finally { clearTimeout(timer); }
}

const payload = (deviceId: string, licenseKey: string) => ({
  machine_id: deviceId, license_key: licenseKey, project_code: PROJECT_CODE,
  app_version: Application.nativeApplicationVersion ?? "", platform: "apk",
});

export async function isHubBlocked(): Promise<boolean> {
  try { return (await SecureStore.getItemAsync(K_BLOCK, opts)) === "1"; } catch { return false; }
}
async function setBlocked(v: boolean): Promise<boolean> {
  const before = await isHubBlocked();
  if (before !== v) await SecureStore.setItemAsync(K_BLOCK, v ? "1" : "0", opts);
  return before !== v;
}

/** Tells the Hub this device activated a license (called once, right after a successful local activation). */
export async function hubActivate(deviceId: string, licenseKey: string): Promise<void> {
  if (!HUB_URL) return;
  const r = await call("POST", "/activate", payload(deviceId, licenseKey));
  if (r && interpretHubReply(r.json) === "blocked") await setBlocked(true);
}

/**
 * Heartbeat + kill-switch check (at most every 6 h unless force). Returns true when the blocked flag CHANGED,
 * so the caller can re-run the license check. Unreachable / unclear replies keep the last known state.
 */
export async function hubSync(deviceId: string, licenseKey: string, force = false): Promise<boolean> {
  if (!HUB_URL) return false;
  try {
    const last = parseInt((await SecureStore.getItemAsync(K_SYNC, opts)) ?? "", 10) || undefined;
    if (!shouldSync(last, Date.now(), force)) return false;
    let verdict: HubVerdict = "unknown";
    const hb = await call("POST", "/heartbeat", payload(deviceId, licenseKey));
    if (hb) verdict = interpretHubReply(hb.json);
    if (verdict === "unknown") {
      const st = await call("GET", `/status/${encodeURIComponent(deviceId)}`);
      if (st) verdict = interpretHubReply(st.json);
    }
    if (verdict === "unknown") return false; // offline or unclear: try again next time
    await SecureStore.setItemAsync(K_SYNC, String(Date.now()), opts);
    return setBlocked(verdict === "blocked");
  } catch { return false; }
}
