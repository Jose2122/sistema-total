const fs = require('fs');
const path = require('path');

function searchMounts(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            searchMounts(filePath);
        } else if (file.endsWith('.jsx')) {
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n');
            lines.forEach((line, idx) => {
                if (line.includes('<Requisiciones')) {
                    console.log(`[${file}:${idx+1}] ${line.trim()}`);
                }
            });
        }
    });
}

searchMounts('c:\\Users\\kmachado\\sistema-compras\\src');
