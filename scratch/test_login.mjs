import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://pugwgdqgsqjtbeouodpo.supabase.co";
const supabaseAnonKey = "sb_publishable_oBdXZE0PPSnj9lv-1qzalA_uB6kHtVu";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const credentials = [
  { email: 'jcontreras.totalclean@gmail.com', password: '123456' },
  { email: 'cvega.totalclean@gmail.com', password: '123456' },
  { email: 'cvega@totalclean.com', password: '123456' },
  { email: 'karincmm1@gmail.com', password: '123456' }
];

async function tryLogins() {
  for (const cred of credentials) {
    console.log(`Trying login for ${cred.email}...`);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cred.email,
      password: cred.password
    });

    if (error) {
      console.log(`Failed: ${error.message}`);
    } else {
      console.log(`SUCCESS! Logged in as ${cred.email}`);
      console.log("User ID:", data.user.id);
      
      // Let's test if we can fetch all perfiles now that we are authenticated!
      const { data: profiles, error: pError } = await supabase
        .from('perfiles')
        .select('*');
      if (pError) {
        console.log("Failed to fetch perfiles:", pError.message);
      } else {
        console.log(`Successfully fetched ${profiles.length} profiles!`);
      }
      return;
    }
  }
}

tryLogins();
