const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const localesDir = path.join(rootDir, 'locales');

// We use en.toml as the structural template (groups, comments, whitespace)
// Split on both \r\n and \n to strip carriage returns cleanly
const enTomlRaw = fs.readFileSync(path.join(localesDir, 'en.toml'), 'utf8');
const lines = enTomlRaw.split(/\r?\n/);

const jsonFiles = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));

console.log('🤖 Transferring localized values from JSON into TOML structures...\n');

let updatedCount = 0;

for (const file of jsonFiles) {
  const lang = file.replace('.json', '');
  const jsonPath = path.join(localesDir, file);
  const tomlPath = path.join(localesDir, `${lang}.toml`);
  
  // Read localized JSON definitions
  const dictRaw = fs.readFileSync(jsonPath, 'utf8').replace(/^\uFEFF/, '');
  let dict;
  try {
    dict = JSON.parse(dictRaw);
  } catch (err) {
    console.error(`❌ Error parsing ${file}: ${err.message}`);
    continue;
  }
  
  // Build new TOML file lines
  const newTomlLines = [];
  let todoCount = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Match line that looks like key = "value"
    // Allows leading spaces and handles arbitrary spaces around =
    const match = line.match(/^([a-zA-Z0-9_-]+)\s*=\s*(.*)$/);
    
    if (match) {
      const key = match[1];
      
      if (dict[key] !== undefined) {
        // Key exists in this language's JSON — inject the localized value
        const val = JSON.stringify(dict[key]);
        newTomlLines.push(`${key} = ${val}`);
      } else if (lang === 'en') {
        // For en.toml, always keep the English value as-is
        newTomlLines.push(line);
      } else {
        // Key is NOT in this language's JSON — comment it out rather than
        // silently inheriting the English string
        newTomlLines.push(`# TODO: ${key} = ${match[2]}`);
        todoCount++;
      }
      continue;
    }
    
    // For comments, blank lines, [group] headers — keep exactly as-is
    newTomlLines.push(line);
  }
  
  fs.writeFileSync(tomlPath, newTomlLines.join('\n'), 'utf8');
  const todoNote = todoCount > 0 ? ` (${todoCount} untranslated keys marked # TODO)` : '';
  console.log(`✅ Updated ${lang}.toml from ${lang}.json${todoNote}`);
  updatedCount++;
}

console.log(`\n🎉 Successfully transferred JSON localized values into ${updatedCount} TOML files.`);
