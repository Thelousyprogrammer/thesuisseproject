const fs = require('fs');
const path = require('path');
const { parse } = require('smol-toml');

const rootDir = path.join(__dirname, '..');
const localesDir = path.join(rootDir, 'locales');
const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.toml'));

if (!files.includes('en.toml')) {
  console.error("❌ en.toml not found in locales directory, cannot use as baseline.");
  process.exit(1);
}

// Recursively flattens an object into an array of dot-notated property paths
function getFlattedKeys(obj, prefix = '') {
  let keys = [];
  for (const key in obj) {
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      keys = keys.concat(getFlattedKeys(obj[key], prefix ? `${prefix}.${key}` : key));
    } else {
      keys.push(prefix ? `${prefix}.${key}` : key);
    }
  }
  return keys;
}

// Helper to group keys by their dot-notated prefix and print them
const printGrouped = (keysArray, label, emptyMessage = null) => {
  console.log(label);
  if (keysArray.length === 0) {
    if (emptyMessage) console.log(`      ${emptyMessage}`);
    return;
  }
  const grouped = {};
  for (const key of keysArray) {
    const parts = key.split('.');
    let field = key;
    let group = '[root]';
    if (parts.length > 1) {
      field = parts.pop();
      group = `[${parts.join('.')}]`;
    }
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push(field);
  }
  for (const group in grouped) {
    console.log(`      - ${group} ${grouped[group].join(', ')}`);
  }
};

const enRaw = fs.readFileSync(path.join(localesDir, 'en.toml'), 'utf8');
const enParsed = parse(enRaw);
const enKeysArray = getFlattedKeys(enParsed);
const enKeys = new Set(enKeysArray);

console.log(`===============================================`);
console.log(`🌐 TOML LOCALE COMPARISON TOOL`);
console.log(`===============================================`);
console.log(`Loaded English baseline with ${enKeys.size} structured keys.\n`);

let hasDifferencesAtAll = false;

for (const file of files) {
  if (file === 'en.toml') continue;
  
  const raw = fs.readFileSync(path.join(localesDir, file), 'utf8');
  let parsed;
  try {
    parsed = parse(raw);
  } catch (e) {
    console.error(`❌ Error parsing ${file}: ${e.message}`);
    continue;
  }
  
  const currentKeysArray = getFlattedKeys(parsed);
  const currentKeys = new Set(currentKeysArray);
  
  const missingInCurrent = [];
  const extraInCurrent = [];
  
  // Checking for keys present in english but missing in the current language
  for (const key of enKeys) {
    if (!currentKeys.has(key)) missingInCurrent.push(key);
  }
  
  // Checking for keys present in the current language but not english
  for (const key of currentKeys) {
    if (!enKeys.has(key)) extraInCurrent.push(key);
  }
  
  if (missingInCurrent.length > 0 || extraInCurrent.length > 0) {
    hasDifferencesAtAll = true;
    console.log(`=== 📄 ${file} ===`);
    
    printGrouped(missingInCurrent, `  ❌ Missing keys (Available in English but not in ${file}):`, `✅ None`);
    printGrouped(extraInCurrent, `  ⚠️  Extra keys (Available in ${file} but not in English):`, `✅ None`);
    console.log('');
  } else {
    // Uncomment the next line if you want to see a confirmation for matching files
    // console.log(`=== 📄 ${file} ===\n  ✅ All keys perfectly match en.toml!\n`);
  }
}

if (!hasDifferencesAtAll) {
  console.log(`\n✅ All other .toml locales perfectly match en.toml!`);
} else {
  console.log(`\n🔍 Comparison complete.`);
}
