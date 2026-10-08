import fs from 'fs';

const content = fs.readFileSync('src/Compras.jsx', 'utf8');
const lines = content.split('\n');

lines.forEach((l, idx) => {
  if (l.includes('doc_tipo') || l.includes('doc_numero') || l.includes('factura_url') || l.includes('FAC:') || l.includes('Paperclip') || l.includes('📎')) {
    console.log(`Line ${idx + 1}: ${l.trim().substring(0, 140)}`);
  }
});
