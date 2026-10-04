import { getAppSettings, updateAppSettings, getMaterialById } from '../lib/db/index.js';

async function runTest() {
  console.log('--- Testing Global Document Access Mode ---');
  
  // 1. Check default settings
  let settings = await getAppSettings();
  console.log('Initial app settings:', settings);

  // 2. Turn off downloads (Preview Only)
  settings = await updateAppSettings({ allow_user_downloads: false });
  console.log('Updated app settings (Downloads OFF):', settings);

  // 3. Turn on downloads
  settings = await updateAppSettings({ allow_user_downloads: true });
  console.log('Restored app settings (Downloads ON):', settings);

  console.log('--- Database Settings Test Passed ---');
}

runTest().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
