const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\kmachado\\sistema-compras\\src\\TicketExpress.jsx', 'utf8');
const lines = content.split('\n');
for (let i = 550; i <= 570; i++) {
    console.log(`${i}: ${lines[i-1]}`);
}
