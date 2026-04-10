const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'scripts');

// 1. Create store.js
const storeCode = `let _records = [];

export const Store = {
    getRecords: () => _records,
    setRecords: (newRecords) => {
        _records = Array.isArray(newRecords) ? newRecords : [];
    },
    addRecord: (record) => {
        _records.push(record);
    },
    updateRecord: (index, record) => {
        _records[index] = record;
    },
    removeRecordAt: (index) => {
        _records.splice(index, 1);
    },
    popRecord: () => {
        return _records.pop();
    },
    clear: () => {
        _records = [];
    }
};
`;
fs.writeFileSync(path.join(srcDir, 'store.js'), storeCode);

// 2. Refactor all .js files in scripts/ (except store.js and third party)
const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.js') && f !== 'store.js');

let filesModified = 0;

for (const file of files) {
    let content = fs.readFileSync(path.join(srcDir, file), 'utf8');
    let original = content;

    // We don't prepend import to test scripts or worker yet if we prefer, but let's just do it to those that have dailyRecords or we can explicitly attach them to window for now to make sure HTML onclick works.
    
    // First, let's just replace assignments: 
    // dailyRecords = []  -> Store.clear()
    content = content.replace(/dailyRecords\s*=\s*\[\];?/g, 'Store.clear();');
    
    // dailyRecords = await loadDTRRecords() -> Store.setRecords(await loadDTRRecords())
    content = content.replace(/dailyRecords\s*=\s*(.+?);/g, (match, expr) => {
        if (expr.trim() === '[]') return 'Store.clear();';
        return `Store.setRecords(${expr});`;
    });

    // dailyRecords.push(x) -> Store.addRecord(x)
    content = content.replace(/dailyRecords\.push\(([^)]+)\)/g, 'Store.addRecord($1)');
    
    // dailyRecords.pop() -> Store.popRecord()
    content = content.replace(/dailyRecords\.pop\(\)/g, 'Store.popRecord()');
    
    // dailyRecords.splice(idx, 1) -> Store.removeRecordAt(idx)
    content = content.replace(/dailyRecords\.splice\(([^,]+),\s*1\)/g, 'Store.removeRecordAt($1)');
    
    // dailyRecords[editingIndex] = newRecord;
    content = content.replace(/dailyRecords\[([^\]]+)\]\s*=\s*(.+?);/g, 'Store.updateRecord($1, $2);');

    // dailyRecords -> Store.getRecords()
    // We use a negative lookbehind/lookahead to avoid matching mid-word
    content = content.replace(/\bdailyRecords\b/g, 'Store.getRecords()');

    if (content !== original) {
        // Prepend import if changed
        if (!content.includes('import { Store }')) {
            content = `import { Store } from './store.js';\n` + content;
        }
        fs.writeFileSync(path.join(srcDir, file), content);
        filesModified++;
    }
}

// 3. For ES Modules, functions defined in the files are NOT global.
// We need to attach things to window so HTML onclick properties still work.
// We'll write another script or do it here if needed, but for now let's just do the store replacement.
console.log(`Refactored dailyRecords to Store in ${filesModified} files.`);
