import fs from 'fs';
import path from 'path';

const content = fs.readFileSync('.env.local', 'utf-8');
content.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    console.log(parts[0].trim());
  }
});
