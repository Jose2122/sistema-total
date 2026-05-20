const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\kmachado\\sistema-compras\\src\\SolicitudFondos.jsx', 'utf8');
const lines = content.split('\n');
for (let i = 490; i <= 530; i++) {
    console.log(`${i}: ${lines[i-1]}`);
}
