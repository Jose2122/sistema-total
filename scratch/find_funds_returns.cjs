const fs = require('fs');
const content = fs.readFileSync('c:/Users/kmachado/sistema-compras/src/SolicitudFondos.jsx', 'utf-8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (idx > 1000 && (line.includes('return (') || line.includes('return(') || line.includes('return <') || line.includes('return  <'))) {
    console.log(`Line ${idx+1}: ${line.trim()}`);
  }
});
