import fs from 'fs';
const filePath = 'c:/Users/kmachado/sistema-compras/src/ModuloTicketsPago.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Fix the thead/tbody issue
content = content.replace(/<\/thead>\s+\{filtrados\.map\(ticket => \{/g, '</thead>\n              <tbody>\n                {filtrados.map(ticket => {');

// Fix the end of table issue if it still exists
content = content.replace(/\s+<\/tr>\s+\);\s+\}\)\s+<\/tr>\s+\)\)\s+<\/tbody>/g, '\n                  );\n                })}\n              </tbody>');

fs.writeFileSync(filePath, content);
console.log("File fixed successfully");
