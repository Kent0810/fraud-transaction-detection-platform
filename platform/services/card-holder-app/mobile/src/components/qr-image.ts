import jsQR from 'jsqr';
import { Platform } from 'react-native';

/**
 * Lets the user pick a QR image (a screenshot of a bank's code, say) and reads it. Web only: the browser's file picker
 * and a canvas do the work. Resolves null when nothing was picked or no code was found.
 */
export function pickQrImage(): Promise<string | null> {
  if (Platform.OS !== 'web') return Promise.resolve(null);
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        URL.revokeObjectURL(url);
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0);
        const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        resolve(jsQR(data, width, height)?.data ?? null);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    };
    input.click();
  });
}
