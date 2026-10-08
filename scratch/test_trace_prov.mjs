import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { 
  obtenerTodosProveedores, 
  sonProveedoresCoincidentes, 
  deduplicarListaProveedores,
  normalizarNombreEmpresa 
} from '../src/services/proveedoresService.js';

const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const k = parts[0].trim();
    const v = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '').replace('\r', '');
    env[k] = v;
  }
});

// Polyfill localStorage and window for node test
global.localStorage = {
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; },
  clear() { this.store = {}; }
};
global.window = {
  dispatchEvent() {}
};

async function testTrace() {
  const todos = await obtenerTodosProveedores();
  console.log("Total proveedores devueltos:", todos.length);
  const found = todos.filter(p => p.razon_social?.toUpperCase().includes('TECHNOLOGY') || p.rif?.includes('40282085'));
  console.log("Encontrados en obtenerTodosProveedores():", found.map(p => ({ id: p.id, razon_social: p.razon_social, rif: p.rif, categoria: p.categoria })));

  // Test match between TECHNOLOGY AND SERVICE and other items
  const provNew = {
    id: "PROV-1791470955778",
    rif: "J-40282085-2",
    razon_social: "TECHNOLOGY AND SERVICE",
  };

  todos.forEach(p => {
    if (p.id !== provNew.id && sonProveedoresCoincidentes(p, provNew)) {
      console.log("MATCH DETECTADO con:", p.id, p.razon_social, p.rif);
    }
  });
}
testTrace();
