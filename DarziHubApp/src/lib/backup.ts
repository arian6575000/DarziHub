import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Repo } from '../db/repo';
import { exportAll, importAll } from '../db/backupCore';
import { photoIO } from './photos';
import { todayStr } from './dates';

export async function shareTextFile(name: string, content: string, mimeType: string): Promise<void> {
  const f = new File(Paths.cache, name);
  if (f.exists) f.delete();
  f.create();
  await f.write(content);
  if (!(await Sharing.isAvailableAsync())) throw new Error('shareFailed');
  await Sharing.shareAsync(f.uri, { mimeType, dialogTitle: name });
}

export async function exportBackup() {
  const payload = await exportAll(photoIO);
  await shareTextFile(`darzihub-backup-${todayStr()}.json`, JSON.stringify(payload), 'application/json');
  await Repo.markBackup();
}

/** Lets the user pick a backup file. Returns the parsed JSON or null when cancelled. */
export async function pickBackupFile(): Promise<any | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.length) return null;
  const text = await new File(res.assets[0].uri).text();
  try { return JSON.parse(text); } catch { throw new Error('invalidBackup'); }
}

export const restoreBackup = (payload: any, mode: 'merge' | 'replace') => importAll(payload, mode, photoIO);
