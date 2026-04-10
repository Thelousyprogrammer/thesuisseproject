const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

const dom = new JSDOM(html, { 
  runScripts: "dangerously", 
  resources: "usable",
  url: "http://localhost/"
});

dom.window.onerror = function(msg, source, lineno, colno, error) {
  console.log('Error:', msg, 'Line:', lineno, 'Col:', colno);
};
dom.window.eval('const localStorage = { setItem: () => {}, getItem: () => null }; window.localStorage = localStorage;');

setTimeout(() => {
  console.log("storageStatus:", dom.window.document.getElementById('storageStatus')?.textContent);
  console.log("storageIdbStatus:", dom.window.document.getElementById('storageIdbStatus')?.textContent);
}, 2000);
