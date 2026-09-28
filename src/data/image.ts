import type { Photo } from './types';
import { uid } from './util';

const MAX_EDGE = 1600;
const THUMB_EDGE = 480;

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't read that image."));
    };
    img.src = url;
  });
}

function scaleTo(img: HTMLImageElement, edge: number, quality: number): Promise<{ blob: Blob; w: number; h: number }> {
  const ratio = Math.min(1, edge / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * ratio));
  const h = Math.max(1, Math.round(img.naturalHeight * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  // Browsers apply EXIF orientation when drawing <img>, so phone photos stay upright.
  ctx.drawImage(img, 0, 0, w, h);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve({ blob: b, w, h }) : reject(new Error('Image encoding failed'))), 'image/jpeg', quality),
  );
}

/** Resize a camera photo to something sensible for on-device storage. */
export async function processPhoto(file: Blob): Promise<Photo> {
  const img = await loadImage(file);
  const full = await scaleTo(img, MAX_EDGE, 0.82);
  const thumb = await scaleTo(img, THUMB_EDGE, 0.75);
  return { id: uid('ph_'), blob: full.blob, thumb: thumb.blob, width: full.w, height: full.h, createdAt: Date.now() };
}
