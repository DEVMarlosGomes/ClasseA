import { SPARK, loadStorage } from './firebase';

/** Square-ish photo downscaled to a small JPEG data URL (a few dozen KB fits in a Firestore field). */
async function toDataUrl(file: File, maxSide: number): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.82);
}

/** Uploads a profile photo and returns the URL to store. Spark plan has no Storage: inline data URL. */
export async function uploadImage(path: string, file: File): Promise<string> {
  if (SPARK) return toDataUrl(file, 320);
  const { storage, ref, uploadBytes, getDownloadURL } = await loadStorage();
  const r = ref(storage, path);
  await uploadBytes(r, file, { contentType: file.type });
  return getDownloadURL(r);
}
