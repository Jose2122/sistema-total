const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\kmachado\\sistema-compras\\src\\Requisiciones.jsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
    if (line.includes('solicitante') && idx >= 2500) {
        console.log(`[Line ${idx + 1}] ${line.trim()}`);
    }
});
