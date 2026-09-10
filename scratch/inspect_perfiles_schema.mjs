import { createClient } from '@supabase/supabase-js';

const url = "https://pugwgdqgsqjtbeouodpo.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1Z3dnZHFnc3FqdGJlb3VvZHBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NDUwMjcsImV4cCI6MjA4ODIyMTAyN30.8LZ1Oe8a-aKr3WeFH7PfXpo8SGXhEKL6vCKbo_JJNvo";

const supabase = createClient(url, key);

async function inspectCols() {
  const cols = ['capacidades', 'delegado_id', 'delegacion_desde', 'delegacion_hasta'];
  for (const c of cols) {
    const { error } = await supabase.from('perfiles').select(c).limit(1);
    if (error) {
      console.log(`Column '${c}' error:`, error.message);
    } else {
      console.log(`Column '${c}' EXISTS!`);
    }
  }
}

inspectCols();
