import fs from 'fs';
import zlib from 'zlib';

const buf = fs.readFileSync('C:\\Users\\Usuario\\.gemini\\antigravity\\brain\\9317dcf5-d5ea-4b45-9b5e-c6ca95d17221\\media__1781118999540.png');

let pos = 8; // skip signature
let idatBuffers = [];

while (pos < buf.length) {
  if (pos + 8 > buf.length) break;
  const length = buf.readUInt32BE(pos);
  const type = buf.toString('ascii', pos + 4, pos + 8);
  
  if (type === 'IDAT') {
    idatBuffers.push(buf.subarray(pos + 8, pos + 8 + length));
  }
  
  pos += 12 + length; // 4 length + 4 type + length + 4 CRC
}

try {
  const combinedIdat = Buffer.concat(idatBuffers);
  const decompressed = zlib.inflateSync(combinedIdat);
  const r = decompressed[1];
  const g = decompressed[2];
  const b = decompressed[3];
  console.log(`HEX_COLOR: #${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`);
} catch (e) {
  console.error('Failed to decompress combined IDAT:', e.message);
}
