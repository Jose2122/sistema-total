const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\kmachado\\sistema-compras\\src\\SolicitudFondos.jsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
    if (line.includes('return (') && idx > 1500) {
        console.log(`[Line ${idx + 1}] ${line.trim()}`);
    }
});
