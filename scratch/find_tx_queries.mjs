import fs from 'fs';

const content = fs.readFileSync('src/TicketExpress.jsx', 'utf8');
const lines = content.split('\n');

lines.forEach((l, idx) => {
  if (l.includes('.from(') || l.includes('supabase') && l.includes('table')) {
    console.log(`Line ${idx + 1}: ${l.trim().substring(0, 130)}`);
  }
});
