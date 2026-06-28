const fs = require('fs');
const content = fs.readFileSync('c:/Users/kmachado/sistema-compras/src/ResumenSesion.jsx', 'utf-8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('KPICard') || line.includes('kpi-card') || line.includes('kpiCard') || line.includes('Gasto Acumulado') || line.includes('Gasto acumulado')) {
    console.log(`Line ${idx+1}: ${line}`);
    // print next 40 lines
    for (let i = Math.max(0, idx - 5); i < Math.min(lines.length, idx + 45); i++) {
      console.log(`   [${i+1}] ${lines[i]}`);
    }
  }
});
