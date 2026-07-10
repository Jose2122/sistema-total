import fs from 'fs';
import path from 'path';

let envPath = path.resolve('.env.local');
if (!fs.existsSync(envPath)) {
  envPath = path.resolve('.env');
}
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.substring(1, value.length - 1);
    }
    env[key] = value.trim();
  }
});

console.log("Keys found in env file:", Object.keys(env));
for (const key of Object.keys(env)) {
  if (key.includes('KEY') || key.includes('URL') || key.includes('ROLE')) {
    console.log(`- ${key}: length ${env[key] ? env[key].length : 0}`);
  }
}
