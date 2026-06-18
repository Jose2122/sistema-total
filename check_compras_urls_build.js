import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, 'src', 'Compras.jsx');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log("Lines 1220 to 1265 in Compras.jsx:");
for (let i = 1219; i < 1265; i++) {
  console.log(`${i + 1}: ${lines[i]}`);
}
