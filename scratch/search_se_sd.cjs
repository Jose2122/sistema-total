const fs = require('fs');
const path = require('path');

function searchDir(dir, query) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            searchDir(filePath, query);
        } else if (file.endsWith('.jsx') || file.endsWith('.js') || file.endsWith('.css')) {
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n');
            lines.forEach((line, idx) => {
                if (line.includes(query)) {
                    console.log(`[${file}:${idx+1}] ${line.trim()}`);
                }
            });
        }
    });
}

console.log("Searching for 'S/E'...");
searchDir('c:\\Users\\kmachado\\sistema-compras\\src', 'S/E');

console.log("\nSearching for 'S/D'...");
searchDir('c:\\Users\\kmachado\\sistema-compras\\src', 'S/D');

console.log("\nSearching for 'sin especificar'...");
searchDir('c:\\Users\\kmachado\\sistema-compras\\src', 'sin especificar');
