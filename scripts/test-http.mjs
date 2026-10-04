async function testAccessControl() {
  const BASE_URL = 'http://localhost:3000';
  console.log('Testing Global Document Access endpoints at:', BASE_URL);

  // 1. Get current settings
  const settingsRes = await fetch(`${BASE_URL}/api/admin/settings`);
  console.log('GET /api/admin/settings status:', settingsRes.status);
  const settingsData = await settingsRes.json();
  console.log('Settings data:', settingsData);

  // 2. Fetch list of materials to get an ID
  const matsRes = await fetch(`${BASE_URL}/api/materials`);
  const matsData = await matsRes.json();
  const sampleMaterial = matsData.materials?.[0];
  console.log('Sample material:', sampleMaterial ? `${sampleMaterial.id} (${sampleMaterial.title})` : 'None found');

  if (sampleMaterial) {
    // 3. Test Preview endpoint
    const previewRes = await fetch(`${BASE_URL}/api/materials/${sampleMaterial.id}/preview`);
    console.log('GET /api/materials/[id]/preview status:', previewRes.status);
    console.log('Preview Content-Type:', previewRes.headers.get('content-type'));
    console.log('Preview Content-Disposition:', previewRes.headers.get('content-disposition'));
  }

  console.log('\n--- Verification script completed ---');
}

testAccessControl().catch(console.error);
