// License check for DarziHub (offline, Ed25519). Storage: Android Keystore via expo-secure-store.
import * as SecureStore from "expo-secure-store";
import { hasFeature, Payload, Reason, verifyLicense, VerifyResult } from "./licenseCore";
import { getDeviceId, getLegacyDeviceId } from "./deviceId";
import { hubActivate, hubSync, isHubBlocked } from "./hubClient";
import { evalTrial, TrialState } from "./trialCore";
import { ACCEPT_LEGACY_DEVICE_ID, KEY_CONFIGURED, PROJECT_CODE, PUBLIC_KEY_HEX } from "./config";

export type CheckResult = VerifyResult | { ok: false; reason: "config" | "blocked" };

const K_LICENSE = "mpos_license";
const K_LASTSEEN = "mpos_lastseen";
const K_TRIAL = "mpos_trial_start";
const opts = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

async function check(license: string): Promise<CheckResult> {
  if (!KEY_CONFIGURED) return { ok: false, reason: "config" };
  const seen = await SecureStore.getItemAsync(K_LASTSEEN, opts);
  const lastSeen = seen ? parseInt(seen, 10) || undefined : undefined;
  const base = { publicKeyHex: PUBLIC_KEY_HEX, projectCode: PROJECT_CODE, lastSeen };
  let r = verifyLicense(license, { ...base, machineId: await getDeviceId() });
  if (!r.ok && r.reason === "machine" && ACCEPT_LEGACY_DEVICE_ID) r = verifyLicense(license, { ...base, machineId: await getLegacyDeviceId() });
  // The signing key is specific to this project, so a Hub key without project_code is valid; one with a different project_code is rejected inside verifyLicense.
  if (r.ok) await SecureStore.setItemAsync(K_LASTSEEN, String(Math.max(Date.now(), lastSeen ?? 0)), opts);
  return r;
}

/** User pasted a license: save it only if valid. */
export async function activateLicense(license: string): Promise<CheckResult> {
  const r = await check(license);
  if (!r.ok) return r;
  await SecureStore.setItemAsync(K_LICENSE, license.trim(), opts);
  // Tell the Hub (best effort, never blocks activation), then apply a kill switch if the Hub already blocked this device.
  const id = await getDeviceId();
  await hubActivate(id, license.trim());
  await hubSync(id, license.trim(), true);
  if (await isHubBlocked()) return { ok: false, reason: "blocked" };
  return r;
}

/** Call on every app start and when the app returns to foreground. */
export async function checkSavedLicense(): Promise<CheckResult> {
  let saved: string | null = null;
  try { saved = await SecureStore.getItemAsync(K_LICENSE, opts); } catch { /* keystore unavailable */ }
  if (!saved) return { ok: false, reason: "format" };
  const r = await check(saved);
  if (r.ok && (await isHubBlocked())) return { ok: false, reason: "blocked" };
  return r;
}

/** Heartbeat + kill switch for the saved license. True when the Hub changed the blocked state (re-run checkSavedLicense). */
export async function refreshFromHub(): Promise<boolean> {
  let saved: string | null = null;
  try { saved = await SecureStore.getItemAsync(K_LICENSE, opts); } catch { /* keystore unavailable */ }
  if (!saved) return false;
  return hubSync(await getDeviceId(), saved);
}

/** Free trial state. Only meaningful while no license is saved. */
export async function getTrialState(): Promise<TrialState> {
  const [st, seen] = await Promise.all([SecureStore.getItemAsync(K_TRIAL, opts), SecureStore.getItemAsync(K_LASTSEEN, opts)]);
  const start = st ? parseInt(st, 10) || undefined : undefined;
  const lastSeen = seen ? parseInt(seen, 10) || undefined : undefined;
  const r = evalTrial(start, Date.now(), lastSeen);
  if (r.status !== "clock") await SecureStore.setItemAsync(K_LASTSEEN, String(Math.max(Date.now(), lastSeen ?? 0)), opts);
  return r;
}

/** Starts the one-time trial. Does nothing if it was already started (even if it has ended). */
export async function startTrial(): Promise<TrialState> {
  const existing = await SecureStore.getItemAsync(K_TRIAL, opts);
  if (!existing) await SecureStore.setItemAsync(K_TRIAL, String(Date.now()), opts);
  return getTrialState();
}

export const can = (p: Payload, feature: string) => hasFeature(p, feature);

export const REASON_KEYS: Record<Reason | "config" | "blocked", string> = {
  format: "licFormat", signature: "licSignature", project: "licProject", machine: "licMachine", expired: "licExpired", clock: "licClock", config: "licConfig", blocked: "licBlocked",
};
