const fs = require('fs');
const path = require('path');

function searchNuevaReq(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            searchNuevaReq(filePath);
        } else if (file.endsWith('.jsx')) {
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n');
            lines.forEach((line, idx) => {
                if (line.toLowerCase().includes('nueva req') || line.toLowerCase().includes('crear req')) {
                    console.log(`[${file}:${idx+1}] ${line.trim()}`);
                }
            });
        }
    });
}

searchNuevaReq('c:\\Users\\kmachado\\sistema-compras\\src');
