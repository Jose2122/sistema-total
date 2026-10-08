import fs from 'fs';

const content = fs.readFileSync('src/AdminAnalytics.jsx', 'utf8');
const lines = content.split('\n');

lines.forEach((l, idx) => {
  if (l.includes('.from(') || l.includes('supabase') || l.includes('tickets') || l.includes('requisicion') || l.includes('trazabilidad') || l.includes('telemetria') || l.includes('kpi') || l.includes('audit')) {
    console.log(`Line ${idx + 1}: ${l.trim().substring(0, 120)}`);
  }
});
