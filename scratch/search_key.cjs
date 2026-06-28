const fs = require('fs');
const path = require('path');

function searchDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (file === 'node_modules' || file === '.git' || file === 'dist') {
      continue;
    }
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      searchDir(fullPath);
    } else if (stat.isFile()) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        const matches = content.match(/eyJ[a-zA-Z0-9_\-\.]{150,}/g);
        if (matches) {
          console.log(`Found JWT in file: ${fullPath}`);
          matches.forEach(m => console.log(m));
        }
      } catch (e) {
        // Skip binary or unreadable files
      }
    }
  }
}

searchDir('.');
