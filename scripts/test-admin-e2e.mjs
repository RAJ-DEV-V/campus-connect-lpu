import assert from 'assert';

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('🧪 Starting End-to-End Admin Dashboard & RBAC Test Suite...\n');

  // 1. Test Unauthenticated Access to /api/admin/stats -> Should be 403 / 401
  console.log('1. Testing Unauthenticated Access to Admin Stats...');
  const unauthRes = await fetch(`${BASE_URL}/api/admin/stats`);
  assert(unauthRes.status === 401 || unauthRes.status === 403, `Expected 401/403 for unauthenticated stats, got ${unauthRes.status}`);
  console.log('   ✓ Unauthenticated access correctly blocked');

  // 2. Test Student Login -> Accessing Admin APIs should be 403
  console.log('\n2. Testing Normal Student Access...');
  const studentLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ preset: 'student_new' }),
  });
  assert(studentLoginRes.ok, 'Student login should succeed');
  const studentCookie = studentLoginRes.headers.get('set-cookie');
  assert(studentCookie, 'Student session cookie must be set');

  // Attempting admin stats as student
  const studentStatsRes = await fetch(`${BASE_URL}/api/admin/stats`, {
    headers: { cookie: studentCookie },
  });
  assert(studentStatsRes.status === 403, `Expected 403 for student accessing admin stats, got ${studentStatsRes.status}`);
  console.log('   ✓ Normal student forbidden (403) from accessing admin stats');

  // Attempting admin roles as student
  const studentRolesRes = await fetch(`${BASE_URL}/api/admin/roles`, {
    headers: { cookie: studentCookie },
  });
  assert(studentRolesRes.status === 403, `Expected 403 for student accessing admin roles, got ${studentRolesRes.status}`);
  console.log('   ✓ Normal student forbidden (403) from accessing admin roles');

  // 3. Test Owner Login (mishra.rajvansh11@gmail.com)
  console.log('\n3. Testing Owner Login (mishra.rajvansh11@gmail.com)...');
  const ownerLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ preset: 'owner' }),
  });
  assert(ownerLoginRes.ok, 'Owner login should succeed');
  const ownerCookie = ownerLoginRes.headers.get('set-cookie');
  assert(ownerCookie, 'Owner cookie must be set');

  const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { cookie: ownerCookie },
  });
  const meData = await meRes.json();
  assert(meData.authenticated === true, 'Owner should be authenticated');
  assert(meData.user.email === 'mishra.rajvansh11@gmail.com', 'Email must match owner');
  assert(meData.user.isAdmin === true, 'Owner must have isAdmin = true');
  assert(meData.user.isOwner === true, 'Owner must have isOwner = true');
  assert(meData.user.role === 'owner', 'Owner role must be "owner"');
  console.log('   ✓ Owner authentication and role verified successfully');

  // 4. Test Admin Stats & Real Telemetry
  console.log('\n4. Testing Real Admin Stats Telemetry...');
  const statsRes = await fetch(`${BASE_URL}/api/admin/stats`, {
    headers: { cookie: ownerCookie },
  });
  assert(statsRes.ok, 'Owner should be able to fetch stats');
  const statsData = await statsRes.json();
  assert(statsData.stats.totalUsers >= 1, 'Stats totalUsers must be >= 1');
  assert(typeof statsData.stats.activeUsers === 'number', 'activeUsers must be a number');
  assert(typeof statsData.stats.activeToday === 'number', 'activeToday must be a number');
  assert(typeof statsData.stats.activeThisWeek === 'number', 'activeThisWeek must be a number');
  assert(typeof statsData.stats.communityVerified === 'number', 'communityVerified must be a number');
  assert(typeof statsData.stats.totalMaterials === 'number', 'totalMaterials must be a number');
  assert(typeof statsData.stats.totalDownloads === 'number', 'totalDownloads must be a number');
  console.log(`   ✓ Stats: Total Users = ${statsData.stats.totalUsers}, Active Users (30d) = ${statsData.stats.activeUsers}, Materials = ${statsData.stats.totalMaterials}, Downloads = ${statsData.stats.totalDownloads}`);

  // 5. Test Download Analytics Endpoint
  console.log('\n5. Testing Download Analytics Endpoint...');
  const analyticsRes = await fetch(`${BASE_URL}/api/admin/analytics`, {
    headers: { cookie: ownerCookie },
  });
  assert(analyticsRes.ok, 'Analytics endpoint should return 200');
  const analyticsData = await analyticsRes.json();
  assert(Array.isArray(analyticsData.analytics.mostDownloaded), 'mostDownloaded must be an array');
  assert(Array.isArray(analyticsData.analytics.recentDownloads), 'recentDownloads must be an array');
  assert(typeof analyticsData.analytics.downloadsByYear === 'object', 'downloadsByYear must be an object');
  assert(typeof analyticsData.analytics.downloadsByType === 'object', 'downloadsByType must be an object');
  console.log(`   ✓ Analytics: Top Materials Count = ${analyticsData.analytics.mostDownloaded.length}, Recent Downloads Feed = ${analyticsData.analytics.recentDownloads.length}`);

  // 6. Test Materials Upload (Year-Wise 1st-4th Year)
  console.log('\n6. Testing Material Upload (3rd Year Notes)...');
  const uploadFormData = new FormData();
  uploadFormData.append('title', 'Distributed Cloud Architecture Mastery 2026');
  uploadFormData.append('subject', 'Cloud Computing');
  uploadFormData.append('subject_code', 'CSE382');
  uploadFormData.append('year', '3');
  uploadFormData.append('material_type', 'Notes');
  uploadFormData.append('description', 'Comprehensive notes on Kubernetes, microservices, and serverless architectures.');

  const uploadRes = await fetch(`${BASE_URL}/api/materials/upload`, {
    method: 'POST',
    headers: { cookie: ownerCookie },
    body: uploadFormData,
  });
  assert(uploadRes.ok, 'Upload should succeed');
  const uploadData = await uploadRes.json();
  assert(uploadData.success === true, 'Upload response must be success');
  const newMaterialId = uploadData.material.id;
  assert(uploadData.material.year === 3, 'Material year must be 3');
  console.log(`   ✓ Successfully uploaded test material: ID = ${newMaterialId}, Year = ${uploadData.material.year}`);

  // 7. Test Material Editing & Patching
  console.log('\n7. Testing Material Edit...');
  const editRes = await fetch(`${BASE_URL}/api/materials/${newMaterialId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      cookie: ownerCookie,
    },
    body: JSON.stringify({
      title: 'Distributed Cloud Architecture Mastery (Updated Edition)',
      material_type: 'Notes',
    }),
  });
  assert(editRes.ok, 'Material edit should succeed');
  const editData = await editRes.json();
  assert(editData.material.title.includes('Updated Edition'), 'Title should be updated');
  console.log('   ✓ Material metadata successfully updated');

  // 8. Test Material Deletion
  console.log('\n8. Testing Material Deletion...');
  const deleteRes = await fetch(`${BASE_URL}/api/materials/${newMaterialId}`, {
    method: 'DELETE',
    headers: { cookie: ownerCookie },
  });
  assert(deleteRes.ok, 'Material delete should succeed');
  console.log('   ✓ Material successfully deleted');

  // 9. Test Community Links Management (Add, Toggle, Delete)
  console.log('\n9. Testing WhatsApp Verification Links...');
  const addLinkRes = await fetch(`${BASE_URL}/api/admin/links`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: ownerCookie,
    },
    body: JSON.stringify({
      name: 'E2E Test Engineering WhatsApp Group',
      invite_url: 'https://chat.whatsapp.com/TEST-E2E-INVITE-CODE-999',
      type: 'community',
      is_active: true,
    }),
  });
  assert(addLinkRes.ok, 'Add link should succeed');
  const linkData = await addLinkRes.json();
  const createdLinkId = linkData.link.id;
  assert(linkData.link.invite_code === 'TEST-E2E-INVITE-CODE-999', 'Code should be extracted');
  console.log(`   ✓ Created WhatsApp link: ${linkData.link.name} (Code: ${linkData.link.invite_code})`);

  // Toggle link active status
  const toggleRes = await fetch(`${BASE_URL}/api/admin/links`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      cookie: ownerCookie,
    },
    body: JSON.stringify({
      id: createdLinkId,
      is_active: false,
    }),
  });
  assert(toggleRes.ok, 'Toggle link should succeed');
  console.log('   ✓ Successfully disabled link status');

  // Delete test link
  const deleteLinkRes = await fetch(`${BASE_URL}/api/admin/links?id=${createdLinkId}`, {
    method: 'DELETE',
    headers: { cookie: ownerCookie },
  });
  assert(deleteLinkRes.ok, 'Delete link should succeed');
  console.log('   ✓ Successfully cleaned up test link');

  // 10. Test Admin Roles Management (Owner Only)
  console.log('\n10. Testing Admin Role Management (Owner Only)...');
  const addAdminRes = await fetch(`${BASE_URL}/api/admin/roles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: ownerCookie,
    },
    body: JSON.stringify({
      email: 'test.coadmin@lpu.in',
      role: 'admin',
    }),
  });
  assert(addAdminRes.ok, 'Owner adding new admin should succeed');
  const newAdminData = await addAdminRes.json();
  console.log(`   ✓ Successfully granted admin role to: ${newAdminData.admin.email}`);

  // Test Owner Protection (Attempting to remove mishra.rajvansh11@gmail.com must fail)
  console.log('\n11. Testing Owner Account Hard Protection...');
  const removeOwnerRes = await fetch(`${BASE_URL}/api/admin/roles?id=mishra.rajvansh11@gmail.com`, {
    method: 'DELETE',
    headers: { cookie: ownerCookie },
  });
  assert(removeOwnerRes.status === 400 || removeOwnerRes.status === 500, 'Attempting to delete owner must fail');
  console.log('   ✓ Deletion of owner account correctly rejected with security exception');

  // Clean up test co-admin
  const removeCoAdminRes = await fetch(`${BASE_URL}/api/admin/roles?id=${newAdminData.admin.id}`, {
    method: 'DELETE',
    headers: { cookie: ownerCookie },
  });
  assert(removeCoAdminRes.ok, 'Removing co-admin should succeed');
  console.log('   ✓ Cleaned up test co-admin');

  console.log('\n======================================================');
  console.log('🎉 ALL 11 ADMIN DASHBOARD & RBAC TEST SCENARIOS PASSED!');
  console.log('======================================================');
}

runTests().catch((err) => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});
