import fs from 'fs';

const content = fs.readFileSync('src/SolicitudFondos.jsx', 'utf8');
const lines = content.split('\n');

lines.forEach((l, idx) => {
  if (l.includes('.from(')) {
    console.log(`Line ${idx + 1}: ${l.trim().substring(0, 130)}`);
  }
});
