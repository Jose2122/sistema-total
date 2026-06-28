import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

async function test() {
  console.log("Testing general internet connectivity (fetching google.com)...");
  try {
    const res = await fetch("https://www.google.com", { method: 'HEAD' });
    console.log("General internet test: SUCCESS. Status code:", res.status);
  } catch (e) {
    console.error("General internet test: FAILED.", e.message);
  }
}

test();
