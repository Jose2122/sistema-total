const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\kmachado\\sistema-compras\\src\\SolicitudFondos.jsx', 'utf8');
const lines = content.split('\n');
for (let i = 2250; i <= 2315; i++) {
    console.log(`${i}: ${lines[i-1]}`);
}
