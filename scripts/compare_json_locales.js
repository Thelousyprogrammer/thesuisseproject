const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const localesDir = path.join(rootDir, 'locales');
const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));

if (!files.includes('en.json')) {
  console.error("❌ en.json not found in locales directory, cannot use as baseline.");
  process.exit(1);
}

const printGrouped = (keysArray, label, emptyMessage = null) => {
  console.log(label);
  if (keysArray.length === 0) {
    if (emptyMessage) console.log(`      ${emptyMessage}`);
    return;
  }
  
  // JSON files in this project are flat. We will just output all keys in one comma-separated line
  console.log(`      - ${keysArray.join(', ')}`);
};

const enRaw = fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8').replace(/^\uFEFF/, '');
const enParsed = JSON.parse(enRaw);
const enKeys = new Set(Object.keys(enParsed));

console.log(`===============================================`);
console.log(`🌐 JSON LOCALE COMPARISON TOOL`);
console.log(`===============================================`);
console.log(`Loaded English baseline with ${enKeys.size} flat keys.\n`);

let hasDifferencesAtAll = false;

for (const file of files) {
  if (file === 'en.json') continue;
  
  const raw = fs.readFileSync(path.join(localesDir, file), 'utf8').replace(/^\uFEFF/, '');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.error(`❌ Error parsing ${file}: ${e.message}`);
    continue;
  }
  
  const currentKeysArray = Object.keys(parsed);
  const currentKeys = new Set(currentKeysArray);
  
  const missingInCurrent = [];
  const extraInCurrent = [];
  
  for (const key of enKeys) {
    if (!currentKeys.has(key)) missingInCurrent.push(key);
  }
  
  for (const key of currentKeys) {
    if (!enKeys.has(key)) extraInCurrent.push(key);
  }
  
  console.log(`=== 📄 ${file} ===`);
  if (missingInCurrent.length > 0 || extraInCurrent.length > 0) {
    hasDifferencesAtAll = true;
    printGrouped(missingInCurrent, `  ❌ Missing keys:`, `✅ None`);
    printGrouped(extraInCurrent, `  ⚠️  Extra keys:`, `✅ None`);
  } else {
    console.log(`  ✅ Complete (perfect match)`);
  }
  console.log('');
}

if (!hasDifferencesAtAll) {
  console.log(`\n✅ All other .json locales perfectly match en.json!`);
} else {
  console.log(`\n🔍 Comparison complete.`);
}
