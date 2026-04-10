const fs=require('fs');
['index.html','telemetry.html','week-comparison.html'].forEach(f=>{
    let c=fs.readFileSync(f,'utf8');
    c=c.replace(/<script src="scripts\//g, '<script type="module" src="scripts/');
    fs.writeFileSync(f,c);
});
console.log('Added type module');
