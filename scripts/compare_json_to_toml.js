const fs = require('fs');
const path = require('path');
const { parse } = require('smol-toml');

const rootDir = path.join(__dirname, '..');
const localesDir = path.join(rootDir, 'locales');

// Get all languages by looking at existing .json files
const jsonFiles = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));

// Recursively find all "leaf" property names from a parsed TOML object
function getLeafKeys(obj) {
  let keys = [];
  for (const key in obj) {
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      keys = keys.concat(getLeafKeys(obj[key]));
    } else {
      keys.push(key);
    }
  }
  return keys;
}

console.log('🔍 Comparing JSON dictionaries vs TOML structures...\n');

let totalMissingAnywhere = 0;

for (const file of jsonFiles) {
  const lang = file.replace('.json', '');
  const jsonPath = path.join(localesDir, file);
  const tomlPath = path.join(localesDir, `${lang}.toml`);
  
  if (!fs.existsSync(tomlPath)) {
    console.error(`❌ TOML file missing for ${lang}!`);
    continue;
  }

  // Load JSON Keys
  let jsonKeys = [];
  try {
    const rawJson = fs.readFileSync(jsonPath, 'utf8').replace(/^\uFEFF/, '');
    jsonKeys = Object.keys(JSON.parse(rawJson));
  } catch(e) {
    console.error(`❌ Error parsing ${file}: ${e.message}`);
    continue;
  }
  
  // Load TOML Leaf Keys
  let tomlLeafKeys = [];
  try {
    const rawToml = fs.readFileSync(tomlPath, 'utf8');
    const parsedToml = parse(rawToml);
    tomlLeafKeys = getLeafKeys(parsedToml);
  } catch(e) {
    console.error(`❌ Error parsing ${lang}.toml: ${e.message}`);
    continue;
  }
  
  const tomlKeySet = new Set(tomlLeafKeys);
  const missingInToml = [];
  
  for (const key of jsonKeys) {
    if (!tomlKeySet.has(key)) {
      missingInToml.push(key);
    }
  }
  
  console.log(`=== 📄 ${lang} ===`);
  if (missingInToml.length > 0) {
    console.log(`  ❌ The following JSON keys are NOT yet in ${lang}.toml structure:`);
    // Output comma separated
    console.log(`      - ${missingInToml.join(', ')}`);
    console.log(`  (Total missing: ${missingInToml.length})\n`);
    totalMissingAnywhere += missingInToml.length;
  } else {
    console.log(`  ✅ Complete! Every JSON key exists in the TOML structure.\n`);
  }
}

if (totalMissingAnywhere > 0) {
  console.log(`⚠️  Summary: There are missing IDs across the TOML files that still lack groups!`);
} else {
  console.log(`🎉  Summary: Flawless! All JSON IDs have been fully mapped to TOML groups.`);
}
