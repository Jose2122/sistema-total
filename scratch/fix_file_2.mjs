import fs from 'fs';
const filePath = 'c:/Users/kmachado/sistema-compras/src/ModuloTicketsPago.jsx';
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/<\/td>\s+\);\s+\}\)/g, '</td>\n                    </tr>\n                  );\n                }');

fs.writeFileSync(filePath, content);
console.log("File fixed successfully");
