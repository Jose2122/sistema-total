require('dotenv').config({ path: '.env.local' });

async function check() {
  try {
    const url = process.env.VITE_SUPABASE_URL + '/rest/v1/';
    const res = await fetch(url, {
      headers: {
        'apikey': process.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${process.env.VITE_SUPABASE_SERVICE_ROLE_KEY}`
      }
    });
    console.log("Status:", res.status);
    const schema = await res.json();
    
    console.log("\nBancos schema definitions:");
    if (schema.definitions.bancos) {
      console.log(JSON.stringify(schema.definitions.bancos.properties, null, 2));
    } else {
      console.log("No definition for bancos");
    }

    console.log("\nTickets_directos schema definitions:");
    if (schema.definitions.tickets_directos) {
      console.log(JSON.stringify(schema.definitions.tickets_directos.properties, null, 2));
    } else {
      console.log("No definition for tickets_directos");
    }
  } catch (e) {
    console.error("Error:", e.message);
  }
}
check();
