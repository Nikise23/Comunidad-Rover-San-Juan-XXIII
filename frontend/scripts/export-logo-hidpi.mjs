/**
 * Genera logo@2x.png y logo@3x.png a partir de public/logo.png
 * para srcSet (pantallas Retina). Volvé a ejecutar si reemplazás el logo base.
 */
import sharp from 'sharp';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');
const logoPath = join(publicDir, 'logo.png');

const buf = readFileSync(logoPath);
const meta = await sharp(buf).metadata();
const w = meta.width ?? 1;
const h = meta.height ?? 1;

for (const scale of [2, 3]) {
  const out = join(publicDir, `logo@${scale}x.png`);
  await sharp(buf)
    .resize(Math.round(w * scale), Math.round(h * scale), {
      kernel: sharp.kernel.lanczos3,
      fit: 'fill',
    })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(out);
  console.log('OK', out, Math.round(w * scale), 'x', Math.round(h * scale));
}
