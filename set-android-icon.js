/**
 * set-android-icon.js
 *
 * Copies assets/icon.png into every Android mipmap-* directory as
 * ic_launcher.png and ic_launcher_round.png.
 *
 * Android scales launcher icons at render time, so a single
 * high-resolution source (1024×1024) works fine for development.
 * For a production release, replace with properly-sized PNGs per density.
 *
 * Run: node set-android-icon.js
 */

const fs   = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'assets', 'icon.png');
const RES = path.join(__dirname, 'android', 'app', 'src', 'main', 'res');

if (!fs.existsSync(SRC)) {
  console.error('✗  assets/icon.png not found — run: node create-placeholder-assets.js');
  process.exit(1);
}

const DENSITIES = ['mipmap-mdpi', 'mipmap-hdpi', 'mipmap-xhdpi', 'mipmap-xxhdpi', 'mipmap-xxxhdpi'];

DENSITIES.forEach((density) => {
  const dir = path.join(RES, density);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  ['ic_launcher.png', 'ic_launcher_round.png'].forEach((name) => {
    const dest = path.join(dir, name);
    fs.copyFileSync(SRC, dest);
    console.log(`✅  ${density}/${name}`);
  });
});

console.log('\nAndroid launcher icons updated.');
console.log('Now run:  npx react-native run-android\n');
