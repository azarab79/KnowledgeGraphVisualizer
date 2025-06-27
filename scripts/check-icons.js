import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Adjusted paths to be relative to the project root where the script is run from
const ICONS_DIR = path.join(__dirname, '..', '360t-kg-ui', 'public', 'svg');
const ICON_MAP_FILE = path.join(__dirname, '..', '360t-kg-ui', 'src', 'constants', 'iconMap.js');

function checkIconMap() {
  console.log('Checking icon map integrity...');

  try {
    // Read the iconMap.js file content
    const iconMapContent = fs.readFileSync(ICON_MAP_FILE, 'utf8');
    
    // A bit of a hacky way to extract the ICON_MAP object without a full JS parser
    // This looks for `export const ICON_MAP = {` and the closing `};`
    const match = iconMapContent.match(/export const ICON_MAP = (\{[\s\S]*?\});/);
    if (!match || !match[1]) {
      throw new Error('Could not find or parse ICON_MAP in iconMap.js. Make sure it is exported as `export const ICON_MAP = { ... };`');
    }

    // Use eval in a safe context to parse the object string
    const ICON_MAP = (0, eval)('(' + match[1] + ')');

    // Read the list of SVG files from the directory
    const availableIcons = fs.readdirSync(ICONS_DIR);

    let hasErrors = false;
    const mappedIcons = new Set(Object.values(ICON_MAP));

    // 1. Check if every icon in ICON_MAP exists in the filesystem
    for (const [label, iconFile] of Object.entries(ICON_MAP)) {
      if (!availableIcons.includes(iconFile)) {
        console.error(`❌ ERROR: Icon for label "${label}" ("${iconFile}") is mapped but does not exist in ${ICONS_DIR}`);
        hasErrors = true;
      }
    }

    // 2. (Optional Warning) Check if there are SVG files that are not used in the map
    for (const svgFile of availableIcons) {
      if (svgFile.endsWith('.svg') && !mappedIcons.has(svgFile)) {
        console.warn(`⚠️ WARNING: Icon file "${svgFile}" exists but is not used in ICON_MAP.`);
      }
    }

    if (hasErrors) {
      console.error('\nIcon map check failed. Please fix the errors listed above.');
      process.exit(1); // Exit with error code
    } else {
      console.log('✅ Icon map is consistent with the filesystem.');
    }
  } catch (error) {
    console.error(`🚨 An unexpected error occurred: ${error.message}`);
    process.exit(1);
  }
}

checkIconMap(); 