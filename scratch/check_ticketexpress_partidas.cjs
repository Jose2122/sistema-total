const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\kmachado\\sistema-compras\\src\\TicketExpress.jsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
    if (line.includes('partidas_fondos')) {
        console.log(`\n=== Line ${idx + 1} ===`);
        for (let i = idx - 5; i <= idx + 5; i++) {
            if (i >= 0 && i < lines.length) {
                console.log(`${i+1}: ${lines[i]}`);
            }
        }
    }
});
