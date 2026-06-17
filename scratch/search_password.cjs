const fs = require('fs');
const readline = require('readline');

async function findCredentials() {
  const fileStream = fs.createReadStream('C:\\Users\\Usuario\\.gemini\\antigravity\\brain\\9317dcf5-d5ea-4b45-9b5e-c6ca95d17221\\.system_generated\\logs\\transcript.jsonl');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const lines = [];
  for await (const line of rl) {
    if (line.includes('jcontreras.totalclean@gmail.com') || line.includes('cvega.totalclean@gmail.com')) {
      lines.push(line);
    }
  }

  console.log(`Found ${lines.length} lines. Printing the last 10 lines:`);
  lines.slice(-10).forEach(l => {
    // Truncate long lines to avoid flooding output
    console.log(l.substring(0, 500));
    console.log("------------------------");
  });
}

findCredentials();
