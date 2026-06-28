const fs = require('fs');
const readline = require('readline');

async function findJWT() {
  const fileStream = fs.createReadStream('C:\\Users\\Usuario\\.gemini\\antigravity\\brain\\9317dcf5-d5ea-4b45-9b5e-c6ca95d17221\\.system_generated\\logs\\transcript.jsonl');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const foundKeys = new Set();

  for await (const line of rl) {
    // Search for JWT-like strings
    const matches = line.match(/eyJ[a-zA-Z0-9_\-\.]{100,}/g);
    if (matches) {
      for (const m of matches) {
        // Exclude the publishable/anon key if it's shorter, but service role key is very long (around 200-300+ chars)
        if (m.length > 150) {
          foundKeys.add(m);
        }
      }
    }
  }

  console.log("Found JWT keys:");
  foundKeys.forEach(k => console.log(k));
}

findJWT();
