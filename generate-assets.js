/**
 * generate-assets.js — generate app icon + splash screen assets
 *
 * Run AFTER installing dependencies:
 *   node generate-assets.js
 *
 * Prerequisites:
 *   1. Place your 1024×1024 app icon PNG at:    assets/icon.png
 *   2. Place your splash logo PNG (≥ 200×200) at: assets/splash-logo.png
 *   3. npm install (react-native-bootsplash must be installed)
 *
 * What this script does:
 *   • Calls react-native-bootsplash generate to produce all splash assets
 *   • Prints instructions for app icon generation (use a tool like appicon.co)
 */

const { execSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

const ICON_PATH        = path.join(__dirname, 'assets', 'icon.png');
const SPLASH_LOGO_PATH = path.join(__dirname, 'assets', 'splash-logo.png');
const BG_COLOR         = '#7C3AED'; // primary violet — matches COLORS.primary

// ── Check assets exist ────────────────────────────────────────────────────────
if (!fs.existsSync(ICON_PATH)) {
  console.error('✗  Missing: assets/icon.png  (1024×1024 PNG required)');
  console.error('   Create the assets/ folder and place your icon there.');
  process.exit(1);
}

if (!fs.existsSync(SPLASH_LOGO_PATH)) {
  console.error('✗  Missing: assets/splash-logo.png  (your admin logo/shield icon)');
  process.exit(1);
}

// ── Generate splash screen ───────────────────────────────────────────────────
console.log('\n▶  Generating splash screen assets…');
try {
  execSync(
    [
      'npx react-native-bootsplash generate',
      `--background "${BG_COLOR}"`,
      `--logo-width 120`,
      `--platforms android`,
      `--assets-output assets/bootsplash`,
      `--flavor main`,
      SPLASH_LOGO_PATH,
    ].join(' '),
    { stdio: 'inherit' },
  );
  console.log('✓  Splash screen assets generated.\n');
} catch (e) {
  console.error('✗  react-native-bootsplash generate failed. Make sure it is installed:');
  console.error('   npm install react-native-bootsplash');
}

// ── App icon instructions ─────────────────────────────────────────────────────
console.log('─────────────────────────────────────────────────────────────────');
console.log('APP ICON — next steps:');
console.log('');
console.log('  Option A (recommended — free online tool):');
console.log('    1. Go to https://appicon.co');
console.log('    2. Upload assets/icon.png');
console.log('    3. Select iPhone + Android');
console.log('    4. Download and extract');
console.log('    5. Copy AppIcon.appiconset → ios/InquiryDeskAdmin/Images.xcassets/AppIcon.appiconset');
console.log('    6. Copy mipmap-* folders  → android/app/src/main/res/');
console.log('');
console.log('  Option B (react-native-make — CLI):');
console.log('    npx react-native-make set-icon --path assets/icon.png');
console.log('');
console.log('─────────────────────────────────────────────────────────────────');
console.log('VECTOR ICONS — register fonts in iOS:');
console.log('');
console.log('  In Xcode → InquiryDeskAdmin target → Build Phases → Copy Bundle Resources:');
console.log('  Add all .ttf files from node_modules/react-native-vector-icons/Fonts/');
console.log('  (MaterialCommunityIcons.ttf is the one used in this project)');
console.log('');
console.log('─────────────────────────────────────────────────────────────────');
