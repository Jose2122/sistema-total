import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Parse .env.local manually
const envPath = path.resolve('.env.local');
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

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function test() {
  const { data, error } = await supabase.functions.invoke('admin-user-manager', {
    body: { action: 'create_user' }
  });
  console.log("Returned data:", data);
  console.log("Returned error:", error);
  if (error) {
    console.log("Error constructor name:", error.constructor.name);
    console.log("Error status:", error.status);
    console.log("Error keys:", Object.keys(error));
    if (error.context) {
      console.log("error.context constructor:", error.context.constructor.name);
      try {
        if (typeof error.context.json === 'function') {
          const body = await error.context.json();
          console.log("Parsed context JSON:", body);
        } else if (typeof error.context.text === 'function') {
          const text = await error.context.text();
          console.log("Parsed context text:", text);
        } else {
          console.log("error.context has no json/text function, type is:", typeof error.context);
        }
      } catch (e) {
        console.error("Failed to parse context JSON:", e.message);
      }
    }
  }
}
test();
