/**
 * Genera iconos de pestaña / inicio desde public/logo.png (no modifica el logo principal).
 */
import sharp from 'sharp';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');
const logoPath = join(publicDir, 'logo.png');
const logo = readFileSync(logoPath);

const jobs = [
  ['favicon.png', 32],
  ['apple-touch-icon.png', 180],
];

for (const [name, size] of jobs) {
  await sharp(logo)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(join(publicDir, name));
  console.log('OK', name, size);
}
