import fs from 'fs';
const filePath = 'c:/Users/kmachado/sistema-compras/src/ModuloTicketsPago.jsx';
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/\s+\}\)\s+<\/tbody>/g, '\n                })}\n              </tbody>');

fs.writeFileSync(filePath, content);
console.log("File fixed successfully");
