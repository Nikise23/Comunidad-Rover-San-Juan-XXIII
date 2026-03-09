import sharp from 'sharp';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');
const logoPath = join(publicDir, 'logo.png');

const buffer = readFileSync(logoPath);
const { data, info } = await sharp(buffer)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const channels = info.channels; // 4 = RGBA
const BLACK_THRESHOLD = 55; // Píxeles más oscuros que esto → transparentes (solo queda el escudo de color)

for (let i = 0; i < data.length; i += channels) {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  const isBlack = r < BLACK_THRESHOLD && g < BLACK_THRESHOLD && b < BLACK_THRESHOLD;
  if (isBlack) {
    data[i + 3] = 0; // alpha = 0 (transparente)
  }
}

const outBuffer = await sharp(Buffer.from(data), {
  raw: { width: info.width, height: info.height, channels: 4 },
})
  .png()
  .toBuffer();

// Recortar bordes totalmente transparentes para dejar solo el escudo
const { data: data2, info: info2 } = await sharp(outBuffer)
  .raw()
  .toBuffer({ resolveWithObject: true });

let minX = info2.width, minY = info2.height, maxX = 0, maxY = 0;
for (let y = 0; y < info2.height; y++) {
  for (let x = 0; x < info2.width; x++) {
    const i = (y * info2.width + x) * 4;
    if (data2[i + 3] > 0) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}

const w = maxX - minX + 1;
const h = maxY - minY + 1;

await sharp(outBuffer)
  .extract({ left: minX, top: minY, width: w, height: h })
  .png()
  .toFile(logoPath);

console.log('Logo listo: solo el escudo (negro → transparente). Tamaño:', w, 'x', h);
