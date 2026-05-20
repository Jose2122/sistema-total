const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\kmachado\\sistema-compras\\src\\Requisiciones.jsx', 'utf8');
const lines = content.split('\n');
console.log('Total lines:', lines.length);

const keywords = ['insert', 'solicitante', 'usuario', 'creado', 'S/E', 'S.E', 'nombre_persona', 'creador', 'nombre'];
keywords.forEach(kw => {
    const matches = [];
    lines.forEach((line, idx) => {
        if (line.toLowerCase().includes(kw.toLowerCase())) {
            matches.push({ lineNum: idx + 1, content: line.trim() });
        }
    });
    console.log(`\n=== KEYWORD: "${kw}" (${matches.length} matches) ===`);
    matches.slice(0, 15).forEach(m => {
        console.log(`[${m.lineNum}] ${m.content}`);
    });
    if (matches.length > 15) {
        console.log(`... and ${matches.length - 15} more matches`);
    }
});
