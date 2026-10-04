const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const parts = line.split('=');
  const k = parts[0]?.trim();
  const v = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
  if (k && !k.startsWith('#')) env[k] = v;
});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function test() {
  const path1 = 'year-1/DSD/notes/1791100675556-Screenshot_2026-09-27_170251.pdf';
  const { data: b1, error: e1 } = await supabase.storage.from('study-materials').download(path1);
  console.log('File 1 download: error=', e1, 'size=', b1 ? (await b1.arrayBuffer()).byteLength : 0);
  
  const path2 = 'year-1/MTH401/notes/1791102753119-frmCourseSyllabusIPDownload__2_.pdf';
  const { data: b2, error: e2 } = await supabase.storage.from('study-materials').download(path2);
  console.log('File 2 download: error=', e2, 'size=', b2 ? (await b2.arrayBuffer()).byteLength : 0);

  // Check magic bytes
  if (b1) {
    const buf1 = Buffer.from(await b1.arrayBuffer());
    console.log('File 1 magic header:', buf1.subarray(0, 20).toString());
  }
  if (b2) {
    const buf2 = Buffer.from(await b2.arrayBuffer());
    console.log('File 2 magic header:', buf2.subarray(0, 20).toString());
  }
}
test();
