const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\kmachado\\sistema-compras\\src\\Requisiciones.jsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
    if (line.includes('solicitante') && (line.includes('input') || line.includes('value') || line.includes('div') || line.includes('span') || line.includes('label'))) {
        console.log(`[Line ${idx + 1}] ${line.trim()}`);
    }
});
