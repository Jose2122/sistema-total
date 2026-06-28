import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  console.log("Fetching OpenAPI spec from PostgREST with Service Key...");
  const res = await fetch(`${supabaseUrl}/rest/v1/`, {
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`
    }
  });

  if (!res.ok) {
    console.error("HTTP error:", res.status, res.statusText);
    return;
  }

  const spec = await res.json();
  console.log("Paths exposed by API:");
  const paths = Object.keys(spec.paths);
  const rpcs = paths.filter(p => p.startsWith('/rpc/'));
  console.log("RPCs:", rpcs);
  
  console.log("Tables / Views:", paths.filter(p => !p.startsWith('/rpc/')));
}

run();
