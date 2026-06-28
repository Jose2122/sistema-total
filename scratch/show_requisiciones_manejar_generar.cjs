const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\kmachado\\sistema-compras\\src\\Requisiciones.jsx', 'utf8');
const lines = content.split('\n');
for (let i = 1232; i <= 1270; i++) {
    console.log(`${i}: ${lines[i-1]}`);
}
