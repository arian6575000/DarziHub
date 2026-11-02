// Device ID for Expo / React Native client apps (Android + iOS).
// Install: npx expo install expo-application expo-device expo-crypto
import { Platform } from "react-native";
import * as Application from "expo-application";
import * as Device from "expo-device";
import * as Crypto from "expo-crypto";
import { formatDeviceIdFromHex } from "./licenseCore";

let cached: string | null = null;

export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  const stableId =
    Platform.OS === "android"
      ? Application.getAndroidId() ?? ""
      : (await Application.getIosIdForVendorAsync()) ?? "";

  const parts = [
    Platform.OS, stableId, Device.brand ?? "", Device.manufacturer ?? "", Device.modelName ?? "",
    (Device.supportedCpuArchitectures ?? []).join(","),
  ];
  const hex = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, "MPOS-DEVID-v1|" + parts.join("|"));
  cached = formatDeviceIdFromHex(hex.toUpperCase()); // XXXX-XXXX-XXXX-XXXX-XXXX
  return cached;
}
