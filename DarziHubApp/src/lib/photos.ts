import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { PhotoIO } from '../db/backupCore';

const dir = () => {
  const d = new Directory(Paths.document, 'photos');
  if (!d.exists) d.create({ intermediates: true });
  return d;
};
export const photoUri = (name: string) => new File(dir(), name).uri;

const uniqueName = () => `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}.jpg`;

async function shrink(uri: string, width: number, format: SaveFormat, compress: number, base64 = false) {
  const ctx = ImageManipulator.manipulate(uri);
  ctx.resize({ width });
  const ref = await ctx.renderAsync();
  return ref.saveAsync({ format, compress, base64 });
}

/** Resize + compress a picked image and store it in the app's photo folder. Returns the stored file name. */
export async function storePickedImage(uri: string): Promise<string> {
  const out = await shrink(uri, 900, SaveFormat.JPEG, 0.72);
  const name = uniqueName();
  new File(out.uri).copy(new File(dir(), name));
  return name;
}

export function deletePhotoFiles(names: string[]) {
  for (const n of names) { try { const f = new File(dir(), n); if (f.exists) f.delete(); } catch { /* best effort */ } }
}

export async function pickImages(source: 'gallery' | 'camera', limit: number): Promise<string[]> {
  const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted && source === 'camera') throw new Error('photoPermission');
  const res = source === 'camera'
    ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
    : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: limit > 1, selectionLimit: Math.max(1, limit), quality: 1 });
  if (res.canceled) return [];
  return res.assets.map((a) => a.uri);
}

/** Pick a logo and return it as a small PNG data URL (kept inside the settings row). */
export async function pickLogoDataUrl(): Promise<string | null> {
  const uris = await pickImages('gallery', 1);
  if (!uris.length) return null;
  const out = await shrink(uris[0], 320, SaveFormat.PNG, 1, true);
  return out.base64 ? `data:image/png;base64,${out.base64}` : null;
}

export const photoIO: PhotoIO = {
  async toDataUrl(name) {
    try { const f = new File(dir(), name); if (!f.exists) return null; return `data:image/jpeg;base64,${await f.base64()}`; } catch { return null; }
  },
  async fromDataUrl(dataUrl) {
    const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    const name = uniqueName();
    const f = new File(dir(), name);
    f.create();
    await f.write(b64, { encoding: 'base64' });
    return name;
  },
};

/** Delete photo files no order references (run at startup and after "erase all"). */
export async function cleanOrphanPhotos() {
  try {
    const { Repo } = await import('../db/repo');
    const keep = new Set(await Repo.allPhotoFiles());
    for (const item of dir().list()) { if (item instanceof File && !keep.has(item.name)) { try { item.delete(); } catch { /* ignore */ } } }
  } catch { /* best effort */ }
}
