import fs from 'fs';

const code = fs.readFileSync('src/Proveedores.jsx', 'utf-8');
const lines = code.split('\n');

const stack = [];

// Simple tag and bracket tracker
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  // Count { and }
  for (let c = 0; c < line.length; c++) {
    const char = line[c];
    if (char === '{') stack.push({ type: '{', line: i + 1 });
    else if (char === '}') {
      if (stack.length > 0 && stack[stack.length - 1].type === '{') {
        stack.pop();
      } else {
        console.log(`Unmatched } at line ${i + 1}`);
      }
    }
    if (char === '(') stack.push({ type: '(', line: i + 1 });
    else if (char === ')') {
      if (stack.length > 0 && stack[stack.length - 1].type === '(') {
        stack.pop();
      } else {
        console.log(`Unmatched ) at line ${i + 1}`);
      }
    }
  }
}

console.log(`Unclosed brackets count: ${stack.length}`);
if (stack.length > 0) {
  console.log("Last 10 unclosed brackets:", stack.slice(-10));
}
