const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'scripts');
const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.js') && f !== 'store.js');

for (const file of files) {
    let code = fs.readFileSync(path.join(srcDir, file), 'utf8');
    const regex = /^(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_]+)\s*\(/gm;
    let match;
    let toAppend = "\n// --- EXPOSE TO WINDOW FOR HTML INLINE CONTROLLERS ---\n";
    let found = false;
    while ((match = regex.exec(code)) !== null) {
        const funcName = match[1];
        toAppend += `window.${funcName} = window.${funcName} || ${funcName};\n`;
        found = true;
    }
    
    if (found && !code.includes("EXPOSE TO WINDOW FOR HTML INLINE CONTROLLERS")) {
        fs.writeFileSync(path.join(srcDir, file), code + toAppend);
    }
}
console.log("Globals bound to window.");
