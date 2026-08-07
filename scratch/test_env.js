console.log("Environment variables containing SUPABASE or KEY:");
Object.keys(process.env).forEach(k => {
  if (k.includes("SUPABASE") || k.includes("KEY")) {
    console.log(`${k}: ${process.env[k] ? "(defined)" : "(empty)"}`);
  }
});
