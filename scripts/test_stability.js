const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const fs = require('fs');

async function run() {
    console.log("Loading DTR over Virtual DOM...");
    const html = fs.readFileSync('index.html', 'utf8');
    const dom = new JSDOM(html, {
        url: "http://localhost:8080/",
        runScripts: "dangerously",
        resources: "usable"
    });

    let errors = 0;
    dom.window.onerror = function(msg, source, lineno, colno, error) {
        console.error('DOM Error:', msg, 'Line:', lineno, source);
        errors++;
    };
    
    dom.window.console.error = function(...args) {
        console.error('Console Error:', ...args);
        errors++;
    };

    dom.window.eval('const localStorage = { setItem: () => {}, getItem: () => null }; window.localStorage = localStorage;');
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log(`Stability test complete. Errors found: ${errors}`);
}
run();
