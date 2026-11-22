// Copies the shared web app (../web) into ./app so the Electron island always uses the same code.
const fs = require('fs'), path = require('path');
const src = path.join(__dirname, '..', '..', 'web'), dst = path.join(__dirname, '..', 'app');
const skip = new Set(['_headers', 'sw.js', 'README.txt']);
fs.rmSync(dst, { recursive: true, force: true });
fs.cpSync(src, dst, { recursive: true, filter: p => !skip.has(path.basename(p)) });
console.log('web -> desktop/app synced');
