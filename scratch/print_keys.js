import fs from 'fs';
import path from 'path';

const printKeys = (filename) => {
  const envPath = path.resolve(filename);
  if (!fs.existsSync(envPath)) {
    console.log(`${filename} does not exist`);
    return;
  }
  const content = fs.readFileSync(envPath, 'utf-8');
  console.log(`--- ${filename} keys ---`);
  content.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      console.log(match[1]);
    }
  });
};

printKeys('.env');
printKeys('.env.local');
