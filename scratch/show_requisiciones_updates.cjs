const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\kmachado\\sistema-compras\\src\\Requisiciones.jsx', 'utf8');
const lines = content.split('\n');
console.log('--- Lines 725-755 ---');
for (let i = 725; i <= 755; i++) {
    console.log(`${i}: ${lines[i-1]}`);
}
console.log('\n--- Lines 1310-1340 ---');
for (let i = 1310; i <= 1340; i++) {
    console.log(`${i}: ${lines[i-1]}`);
}
