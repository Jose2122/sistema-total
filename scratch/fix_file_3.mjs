import fs from 'fs';
const filePath = 'c:/Users/kmachado/sistema-compras/src/ModuloTicketsPago.jsx';
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/\}\}\s+<\/tbody>/g, '})\n              </tbody>');

fs.writeFileSync(filePath, content);
console.log("File fixed successfully");
