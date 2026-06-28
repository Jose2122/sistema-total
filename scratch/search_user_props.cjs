const fs = require('fs');
const path = require('path');

function searchUserProps(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            searchUserProps(filePath);
        } else if (file.endsWith('.jsx') || file.endsWith('.js')) {
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n');
            lines.forEach((line, idx) => {
                if (line.includes('currentUser.') || line.includes('currentUser?.')) {
                    console.log(`[${file}:${idx+1}] ${line.trim()}`);
                }
            });
        }
    });
}

searchUserProps('c:\\Users\\kmachado\\sistema-compras\\src');
