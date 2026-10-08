import fs from 'fs';

const content = fs.readFileSync('src/ModuloTicketsPago.jsx', 'utf8');
const lines = content.split('\n');

lines.forEach((l, idx) => {
  if (l.includes('.from(') || l.includes('cargarTickets') || l.includes('cargarDatos') || l.includes('tickets') && l.includes('set')) {
    console.log(`Line ${idx + 1}: ${l.trim().substring(0, 130)}`);
  }
});
