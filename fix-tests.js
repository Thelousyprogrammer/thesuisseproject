const fs = require('fs');
const p = 'scripts/';
const files = fs.readdirSync(p).filter(f => f.endsWith('.js') && f !== 'store.js');
files.forEach(f => {
    let c = fs.readFileSync(p+f, 'utf8');
    c = c.replace(/window\.([a-zA-Z0-9_]+)\s*=\s*window\.[a-zA-Z0-9_]+\s*\|\|\s*[a-zA-Z0-9_]+;/g, 
        'if(typeof window !== "undefined") { window.$1 = window.$1 || $1; }');
    fs.writeFileSync(p+f, c);
});
console.log('Fixed test window scoping');
