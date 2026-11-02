import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Repo } from '../db/repo';
import { exportAll, importAll } from '../db/backupCore';
import { photoIO } from './photos';
import { todayStr } from './dates';
import { encryptBackup } from './backupCrypto';

export async function shareTextFile(name: string, content: string, mimeType: string): Promise<void> {
  const f = new File(Paths.cache, name);
  if (f.exists) f.delete();
  f.create();
  await f.write(content);
  try {
    if (!(await Sharing.isAvailableAsync())) throw new Error('shareFailed');
    await Sharing.shareAsync(f.uri, { mimeType, dialogTitle: name });
  } finally {
    try { if (f.exists) f.delete(); } catch { /* best effort: don't leave customer data in the cache */ }
  }
}

export async function exportBackup(password?: string) {
  const payload = await exportAll(photoIO);
  const json = JSON.stringify(payload);
  await shareTextFile(`darzihub-backup-${todayStr()}${password ? '.enc' : ''}.json`, password ? encryptBackup(json, password) : json, 'application/json');
  await Repo.markBackup();
}

/** Lets the user pick a backup file. Returns the parsed JSON or null when cancelled. */
export async function pickBackupFile(): Promise<any | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.length) return null;
  const file = new File(res.assets[0].uri);
  try {
    const text = await file.text();
    try { return JSON.parse(text); } catch { throw new Error('invalidBackup'); }
  } finally { try { if (file.exists) file.delete(); } catch { /* picked copy lives in cache */ } }
}

export const restoreBackup = (payload: any, mode: 'merge' | 'replace') => importAll(payload, mode, photoIO);
