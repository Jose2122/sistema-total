import fs from 'fs';

const content = fs.readFileSync('src/ModuloTicketsPago.jsx', 'utf8');
const lines = content.split('\n');

lines.forEach((l, idx) => {
  if (l.includes('.insert(') || l.includes('.upsert(') || l.includes('.update(') || l.includes('guardar') || l.includes('crearTicket')) {
    console.log(`Line ${idx + 1}: ${l.trim().substring(0, 130)}`);
  }
});
