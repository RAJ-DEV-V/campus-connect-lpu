import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = 'https://hfywrezcwyfwsixqdsye.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhmeXdyZXpjd3lmd3NpeHFkc3llIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTA0NTUwOSwiZXhwIjoyMTA2NjIxNTA5fQ.7Qd3aSbqsnfhtJYNmh3xEYLgj1iIaAxqfH4nrhBp6ZQ';

async function seed() {
  const client = createClient(supabaseUrl, serviceRoleKey);
  const dbJsonPath = path.join(process.cwd(), 'data', 'db.json');
  const dbData = JSON.parse(fs.readFileSync(dbJsonPath, 'utf8'));

  console.log(`Starting migration of ${dbData.materials.length} local materials to Supabase...`);

  let successCount = 0;
  for (let i = 0; i < dbData.materials.length; i++) {
    const m = dbData.materials[i];
    const padded = String(i + 1).padStart(12, '0');
    const deterministicUUID = `00000000-0000-4000-8000-${padded}`;

    const row = {
      id: deterministicUUID,
      title: m.title,
      description: m.description,
      subject: m.subject,
      subject_code: m.subject_code,
      year: m.year,
      material_type: m.material_type,
      file_url: m.file_url,
      file_size: m.file_size,
      download_count: m.download_count || 0,
      created_at: m.created_at || new Date().toISOString(),
      updated_at: m.updated_at || new Date().toISOString(),
    };

    const { error } = await client.from('materials').upsert(row, { onConflict: 'id' });
    if (error) {
      console.error(`Failed to upsert "${m.title}":`, error.message);
    } else {
      successCount++;
    }
  }

  console.log(`Successfully migrated ${successCount} materials to Supabase.`);

  const { count } = await client.from('materials').select('*', { count: 'exact', head: true });
  console.log(`Verified total materials in Supabase: ${count}`);
}

seed().catch(console.error);
