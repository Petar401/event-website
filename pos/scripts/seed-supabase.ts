// Load the Tilda Café demo data into an empty Supabase project.
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run seed:supabase
// (The app also does this automatically on first load when the database is empty.)
import { SupabaseRepo } from "../lib/data/supabase-repo";
import { buildSeed } from "../lib/data/seed";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  const repo = new SupabaseRepo(url, key);
  if (!(await repo.isEmpty()) && !process.argv.includes("--force")) {
    console.log("Database already has products — pass --force to upsert the demo data anyway.");
    return;
  }
  const seed = buildSeed();
  await repo.importSeed(seed);
  console.log(`Seeded ${seed.products.length} products, ${seed.customers.length} customers and ${seed.orders.length} orders.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
