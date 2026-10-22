// Soft PIN lock: keeps casual eyes out. The hash lives in the OS keystore (expo-secure-store).
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const KEY = 'darzi_pin_hash', SALT = 'darzi_pin_salt';
const hash = (pin: string, salt: string) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);

export async function hasPin(): Promise<boolean> {
  try { return !!(await SecureStore.getItemAsync(KEY)); } catch { return false; }
}
export async function setPin(pin: string) {
  const salt = Array.from(Crypto.getRandomBytes(12)).map((b) => b.toString(16).padStart(2, '0')).join('');
  await SecureStore.setItemAsync(SALT, salt);
  await SecureStore.setItemAsync(KEY, await hash(pin, salt));
}
export async function removePin() {
  await SecureStore.deleteItemAsync(KEY); await SecureStore.deleteItemAsync(SALT);
}
export async function verifyPin(pin: string): Promise<boolean> {
  const [salt, h] = await Promise.all([SecureStore.getItemAsync(SALT), SecureStore.getItemAsync(KEY)]);
  return !!h && (await hash(pin, salt || '')) === h;
}
