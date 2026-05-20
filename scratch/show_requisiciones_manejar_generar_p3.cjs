const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\kmachado\\sistema-compras\\src\\Requisiciones.jsx', 'utf8');
const lines = content.split('\n');
for (let i = 1341; i <= 1420; i++) {
    console.log(`${i}: ${lines[i-1]}`);
}
