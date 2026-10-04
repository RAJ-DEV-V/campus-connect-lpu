import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hfywrezcwyfwsixqdsye.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhmeXdyZXpjd3lmd3NpeHFkc3llIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTA0NTUwOSwiZXhwIjoyMTA2NjIxNTA5fQ.7Qd3aSbqsnfhtJYNmh3xEYLgj1iIaAxqfH4nrhBp6ZQ';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhmeXdyZXpjd3lmd3NpeHFkc3llIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwNDU1MDksImV4cCI6MjEwNjYyMTUwOX0.CMrnpjPujjHlH4xV6IuRHJr12SZVYtIWJjzarrEyb2I';

async function diagnose() {
  console.log('--- DIAGNOSING SUPABASE MATERIALS & RLS ---');

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const anonClient = createClient(supabaseUrl, anonKey);

  // 1. Query materials with admin (service role) client
  const { data: adminMaterials, error: adminErr } = await adminClient
    .from('materials')
    .select('*');
  
  console.log('Admin query error:', adminErr);
  console.log('Total materials in Supabase (Service Role):', adminMaterials?.length || 0);
  if (adminMaterials && adminMaterials.length > 0) {
    console.log('Sample Supabase Material columns:', Object.keys(adminMaterials[0]));
    console.log('Sample Supabase Material row:', adminMaterials[0]);
  }

  // 2. Query materials with anon client (unauthenticated or normal user perspective)
  const { data: anonMaterials, error: anonErr } = await anonClient
    .from('materials')
    .select('*');
  console.log('Anon query error (RLS check):', anonErr);
  console.log('Total materials visible to Anon:', anonMaterials?.length || 0);

  // 3. Check users table
  const { data: users, error: userErr } = await adminClient
    .from('users')
    .select('*');
  console.log('Users in Supabase:', users?.length || 0);
  if (users) {
    users.forEach(u => console.log(`User: ${u.email} | ID: ${u.id} | community_joined: ${u.community_joined} | role: ${u.role}`));
  }

  // 4. Test insert as adminClient
  console.log('\nTesting insert to Supabase materials...');
  const testInsert = await adminClient.from('materials').insert({
    title: 'Test Material Diagnostics',
    description: 'Diagnosing visibility',
    subject: 'Computer Science',
    subject_code: 'CSE101',
    year: 1,
    material_type: 'Notes',
    file_url: '/uploads/test.pdf',
    file_size: '1.2 MB',
    download_count: 0
  }).select('*');
  console.log('Insert test result:', testInsert.error || testInsert.data);

  if (testInsert.data?.[0]?.id) {
    // Clean up test insert
    await adminClient.from('materials').delete().eq('id', testInsert.data[0].id);
    console.log('Test material cleaned up.');
  }
}

diagnose().catch(console.error);
