const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\kmachado\\sistema-compras\\src\\Requisiciones.jsx', 'utf8');
const lines = content.split('\n');
for (let i = 1868; i <= 2000; i++) {
    if (lines[i-1].includes('<button') || lines[i-1].includes('onClick')) {
        console.log(`${i}: ${lines[i-1].trim()}`);
    }
}
