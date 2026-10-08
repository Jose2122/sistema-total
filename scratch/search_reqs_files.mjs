import fs from 'fs';
const content = fs.readFileSync('src/Requisiciones.jsx', 'utf8');
const lines = content.split('\n');
lines.forEach((l, idx) => {
  if (l.includes('factura') || l.includes('soporte') || l.includes('archivo') || l.includes('adjunto') || l.includes('upload') || l.includes('Paperclip')) {
    console.log(`Line ${idx + 1}: ${l.trim().substring(0, 120)}`);
  }
});
