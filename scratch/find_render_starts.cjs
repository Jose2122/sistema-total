const fs = require('fs');

const files = {
  fondos: 'c:/Users/kmachado/sistema-compras/src/SolicitudFondos.jsx',
  requisiciones: 'c:/Users/kmachado/sistema-compras/src/Requisiciones.jsx'
};

for (const [name, path] of Object.entries(files)) {
  if (fs.existsSync(path)) {
    const content = fs.readFileSync(path, 'utf-8');
    const lines = content.split('\n');
    console.log(`=== FILE: ${name} ===`);
    lines.forEach((line, idx) => {
      // Find return statements containing divs with titles
      if (line.includes('return (') || line.includes('return(')) {
        console.log(`Return at line ${idx + 1}`);
        // print next 40 lines
        for (let i = idx; i < idx + 60; i++) {
          if (lines[i]) {
            console.log(`   [${i+1}] ${lines[i]}`);
          }
        }
      }
    });
  }
}
