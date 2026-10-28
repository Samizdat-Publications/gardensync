// Photos for the assistant (a seed packet, a sick leaf): shrink to at most `maxSide` pixels and
// re-encode as JPEG, which keeps requests small and drops the photo's location and camera data.
export interface Photo {
  /** Base64 JPEG without the data: prefix, as the API wants it. */
  base64: string;
  /** The same image as a data URL, for the preview in the chat. */
  dataUrl: string;
}

export async function preparePhoto(file: File, maxSide = 1568): Promise<Photo> {
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'].includes(file.type)) throw new Error('not a photo');
  if (file.size > 25 * 1024 * 1024) throw new Error('too large');
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no canvas');
    // White under transparent PNGs, which would otherwise turn black as JPEG.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    return { dataUrl, base64: dataUrl.slice(dataUrl.indexOf(',') + 1) };
  } finally {
    bitmap.close();
  }
}
