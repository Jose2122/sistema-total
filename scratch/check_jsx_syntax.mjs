import fs from 'fs';
import * as esbuild from 'esbuild';

const code = fs.readFileSync('src/Proveedores.jsx', 'utf-8');

try {
  esbuild.transformSync(code, { loader: 'jsx' });
  console.log("ESBUILD JSX VALID!");
} catch (err) {
  console.error("ESBUILD ERROR:", err.message);
  if (err.errors) {
    err.errors.forEach(e => {
      console.error(e.location);
    });
  }
}
