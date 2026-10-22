// Bundle the pinned open-source library; the app never executes CDN scripts.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vendor = path.join(root, 'src/vendor');
mkdirSync(vendor, { recursive: true });
writeFileSync(path.join(vendor, 'leaflet-assets.json'), JSON.stringify({
  js: readFileSync(path.join(root, 'node_modules/leaflet/dist/leaflet.js'), 'utf8'),
  css: readFileSync(path.join(root, 'node_modules/leaflet/dist/leaflet.css'), 'utf8'),
}));
copyFileSync(path.join(root, 'node_modules/leaflet/LICENSE'), path.join(vendor, 'leaflet-LICENSE.txt'));
