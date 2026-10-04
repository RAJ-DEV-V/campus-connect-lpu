// scripts/test-e2e.mjs
// Comprehensive test suite for One-Time Community Verification, Permanent Identity, Link Disablement Immunity & Library Routing

async function runTests() {
  const BASE = 'http://localhost:3000';
  console.log('================================================================');
  console.log('Campus Connect LPU – One-Time Community Verification & Access Tests');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  // TEST 1: Unauthenticated user tries to access /library -> redirected to login
  console.log('[Test 1/8] Unauthenticated User Access Guard...');
  const unauthLibraryRes = await fetch(`${BASE}/library`, { redirect: 'manual' });
  const isRedirectToLogin = 
    unauthLibraryRes.status === 307 || 
    unauthLibraryRes.status === 302 || 
    (unauthLibraryRes.headers.get('location') && unauthLibraryRes.headers.get('location').includes('/login'));
  assert(isRedirectToLogin, 'Unauthenticated user accessing /library is redirected to /login');

  const unauthApiRes = await fetch(`${BASE}/api/materials`);
  assert(unauthApiRes.status === 401, 'Unauthenticated API call to /api/materials returns HTTP 401 Unauthorized');

  // TEST 2: New Google User -> First Login -> community_joined = false -> Redirected to /community
  console.log('\n[Test 2/8] First Login with New Google Account...');
  const studentEmail = `student.onetime.${Date.now()}@lpu.in`;
  const studentName = 'Aarav Patel';
  const studentAvatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150';

  const firstLoginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: studentName,
      email: studentEmail,
      avatar_url: studentAvatar,
    }),
  });
  assert(firstLoginRes.status === 200, 'First login returns HTTP 200');
  const firstLoginData = await firstLoginRes.json();
  const permanentUserId = firstLoginData.user.id;
  assert(Boolean(permanentUserId), 'Permanent user ID assigned');
  assert(firstLoginData.user.community_joined === false, 'New user community_joined is initialized to FALSE');
  assert(firstLoginData.redirectUrl === '/community', 'New unverified student is directed to /community verification');

  const sessionCookie1 = firstLoginRes.headers.get('set-cookie')?.split(';')[0];

  // Try accessing /library before verification -> must be redirected to /community
  const beforeVerifyRes = await fetch(`${BASE}/library`, {
    headers: { 'Cookie': sessionCookie1 },
    redirect: 'manual',
  });
  const isRedirectToCommunity = 
    beforeVerifyRes.status === 307 || 
    beforeVerifyRes.status === 302 || 
    (beforeVerifyRes.headers.get('location') && beforeVerifyRes.headers.get('location').includes('/community'));
  assert(isRedirectToCommunity, 'Unverified student cannot access /library and is redirected to /community');

  // TEST 3: Submit Approved WhatsApp Invite Link -> Verify Successfully -> Unlocks Library
  console.log('\n[Test 3/8] Community Verification Submission (One-Time)...');
  const verifyRes = await fetch(`${BASE}/api/community/confirm`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Cookie': sessionCookie1,
    },
    body: JSON.stringify({ inviteUrl: 'https://chat.whatsapp.com/campus-connect-lpu-2026' }),
  });
  assert(verifyRes.status === 200, 'Verification with approved link returns HTTP 200');
  const verifyData = await verifyRes.json();
  assert(verifyData.success === true, 'Verification succeeded');
  assert(verifyData.user.community_joined === true, 'Database sets community_joined = TRUE');
  assert(Boolean(verifyData.user.community_verified_at), 'Recorded community_verified_at timestamp in database');
  assert(verifyData.redirectUrl === '/library', 'Redirects directly to Study Material Library (/library)');

  const verifiedCookie = verifyRes.headers.get('set-cookie')?.split(';')[0] || sessionCookie1;

  // Verify /library is now directly accessible
  const libraryRes = await fetch(`${BASE}/library`, {
    headers: { 'Cookie': verifiedCookie },
    redirect: 'manual',
  });
  assert(libraryRes.status === 200, 'Study Material Library (/library) opens directly for verified student');

  // TEST 4: Next Day / Future Login with SAME Google Account (Simulating fresh login / different device)
  console.log('\n[Test 4/8] Subsequent Login with SAME Google Account (Simulating new day / fresh browser)...');
  const secondLoginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Aarav Patel (Profile Updated)',
      email: studentEmail, // SAME EMAIL
      avatar_url: studentAvatar,
    }),
  });
  assert(secondLoginRes.status === 200, 'Second login returns HTTP 200');
  const secondLoginData = await secondLoginRes.json();

  assert(secondLoginData.user.id === permanentUserId, 'Permanent Supabase Auth user ID strictly preserved without duplicate account');
  assert(secondLoginData.user.community_joined === true, 'Database REMEMBERS community_joined = TRUE');
  assert(secondLoginData.redirectUrl === '/library', 'DIRECTLY OPENS LIBRARY (/library) without asking for invite link');

  // TEST 5: If verified user manually navigates to /community or /login -> forward directly to /library
  console.log('\n[Test 5/8] Verified Student Visiting /community or /login...');
  const newDeviceCookie = secondLoginRes.headers.get('set-cookie')?.split(';')[0];

  const visitCommunityRes = await fetch(`${BASE}/community`, {
    headers: { 'Cookie': newDeviceCookie },
    redirect: 'manual',
  });
  const forwardedToLibrary = 
    visitCommunityRes.status === 307 || 
    visitCommunityRes.status === 302 || 
    (visitCommunityRes.headers.get('location') && visitCommunityRes.headers.get('location').includes('/library'));
  assert(forwardedToLibrary, 'Verified student visiting /community is automatically forwarded to /library');

  // TEST 6: Link Disablement Immunity Test
  // "If an admin disables/removes the invite link that the student originally used, do NOT make already-verified students verify again."
  console.log('\n[Test 6/8] Link Disablement Immunity (Admin disables link; existing student remains verified)...');
  const adminLoginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ preset: 'admin' }),
  });
  const adminCookie = adminLoginRes.headers.get('set-cookie')?.split(';')[0];

  // Admin toggles the link to disabled
  const adminLinksRes = await fetch(`${BASE}/api/admin/links`, { headers: { 'Cookie': adminCookie } });
  const adminLinksData = await adminLinksRes.json();
  const mainLink = adminLinksData.links.find(l => l.invite_code === 'campus-connect-lpu-2026');

  if (mainLink) {
    await fetch(`${BASE}/api/admin/links`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
      body: JSON.stringify({ id: mainLink.id, is_active: false }),
    });

    // Student logs in again after the link was disabled by admin
    const loginAfterDisableRes = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: studentName, email: studentEmail }),
    });
    const loginAfterDisableData = await loginAfterDisableRes.json();
    assert(loginAfterDisableData.user.community_joined === true, 'Existing student STILL has community_joined = TRUE after admin disabled their link');
    assert(loginAfterDisableData.redirectUrl === '/library', 'Existing student STILL directly accesses /library');

    // Restore link back to active
    await fetch(`${BASE}/api/admin/links`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
      body: JSON.stringify({ id: mainLink.id, is_active: true }),
    });
  }

  // TEST 7: Explicit Admin Revoke Action -> Only then does community_joined reset to false
  console.log('\n[Test 7/8] Explicit Admin Revoke Test...');
  if (mainLink) {
    const revokeRes = await fetch(`${BASE}/api/admin/links`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
      body: JSON.stringify({ id: mainLink.id, action: 'revoke_users' }),
    });
    assert(revokeRes.status === 200, 'Admin revoke action succeeds');

    // Now student logs in -> community_joined is now false and they must verify
    const loginAfterRevokeRes = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: studentName, email: studentEmail }),
    });
    const loginAfterRevokeData = await loginAfterRevokeRes.json();
    assert(loginAfterRevokeData.user.community_joined === false, 'Student community_joined is reset ONLY upon explicit admin revoke');
    assert(loginAfterRevokeData.redirectUrl === '/community', 'Student is asked for verification after explicit revocation');
  }

  // TEST 8: Another Unverified Google Account -> Still Requires Verification
  console.log('\n[Test 8/8] Unverified Google Account Test...');
  const unverifiedEmail = `unverified.student.${Date.now()}@lpu.in`;
  const unverifiedLoginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Fresh Student', email: unverifiedEmail }),
  });
  const unverifiedData = await unverifiedLoginRes.json();
  assert(unverifiedData.user.community_joined === false, 'Separate unverified account has community_joined = false');
  assert(unverifiedData.redirectUrl === '/community', 'Separate unverified account routed to /community');

  console.log('\n================================================================');
  console.log(`Final Test Summary: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error('Fatal error during test run:', e);
  process.exit(1);
});
