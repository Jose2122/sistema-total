const fs = require('fs');

function searchSupabaseRequisiciones(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
        if (line.includes("'requisiciones'") || line.includes('"requisiciones"')) {
            console.log(`[${filePath.split('\\').pop()}:${idx+1}] ${line.trim()}`);
        }
    });
}

searchSupabaseRequisiciones('c:\\Users\\kmachado\\sistema-compras\\src\\Requisiciones.jsx');
searchSupabaseRequisiciones('c:\\Users\\kmachado\\sistema-compras\\src\\SolicitudFondos.jsx');
searchSupabaseRequisiciones('c:\\Users\\kmachado\\sistema-compras\\src\\Dashboard.jsx');
