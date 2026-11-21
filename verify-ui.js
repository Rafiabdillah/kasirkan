// Verifikasi kontrak redesign: id/data-act tetap ada, CSS seimbang, token lengkap.
const fs = require('fs');
const app = fs.readFileSync('app.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('style.css', 'utf8');

let pass = 0, fail = 0;
function ok(n, c, e) { if (c) { pass++; console.log('PASS  ' + n); } else { fail++; console.log('FAIL  ' + n + (e ? ' -> ' + e : '')); } }

// 1. Semua id statis yang dipakai app.js harus ada di HTML atau dibuat app.js
const staticIds = new Set();
let m, re = /\$\('([A-Za-z0-9_]+)'\)/g;
while ((m = re.exec(app))) staticIds.add(m[1]);
const dynIds = new Set();
re = /id='([A-Za-z0-9_]+)'/g;
while ((m = re.exec(app))) dynIds.add(m[1]);
// id yang dibuat via helper numInput('id', ...) atau field(..., "<... id='...'") 
re = /numInput\('([A-Za-z0-9_]+)'/g;
while ((m = re.exec(app))) dynIds.add(m[1]);
re = /getElementById\('([A-Za-z0-9_]+)'\)/g;
while ((m = re.exec(app))) dynIds.add(m[1]);
const missing = [];
staticIds.forEach(function (id) {
  const inHtml = html.indexOf('id="' + id + '"') !== -1;
  const inApp = dynIds.has(id) || app.indexOf("id='" + id + "'") !== -1;
  if (!inHtml && !inApp) missing.push(id);
});
ok('Semua id statis app.js tersedia', missing.length === 0, missing.join(', '));
ok('id #view ada', html.indexOf('id="view"') !== -1);
ok('id #tabbar ada', html.indexOf('id="tabbar"') !== -1);
ok('id #btnQuick ada', html.indexOf('id="btnQuick"') !== -1);
ok('id #modal & #modalBody ada', html.indexOf('id="modal"') !== -1 && html.indexOf('id="modalBody"') !== -1);

// 2. Semua data-tab & data-act dari app.js tetap bisa ditangani
const tabs = ['beranda', 'transaksi', 'produk', 'hutang', 'kalkulator', 'laporan', 'pengaturan'];
const missingTabs = tabs.filter(function (t) { return html.indexOf('data-tab="' + t + '"') === -1; });
ok('7 tab navigasi lengkap', missingTabs.length === 0, missingTabs.join(', '));

// 3. CSS seimbang & token
const ob = (css.match(/{/g) || []).length, cb = (css.match(/}/g) || []).length;
ok('CSS braces seimbang', ob === cb, ob + ' vs ' + cb);
const needTokens = ['--primary', '--bg', '--surface', '--text', '--line', '--good', '--bad', '--warn', '--s1', '--r-md', '--shadow-1', '--fs-md', '--dur', '--ease'];
const missTok = needTokens.filter(function (t) { return css.indexOf(t + ':') === -1; });
ok('Design tokens inti ada', missTok.length === 0, missTok.join(', '));
ok('Dark mode (prefers-color-scheme)', /prefers-color-scheme:\s*dark/.test(css));
ok('Guard overflow-x', /overflow-x:\s*clip/.test(css));
ok('tabular-nums', /tabular-nums/.test(css));
ok('Safe-area iOS', /env\(safe-area-inset/.test(css));
ok('prefers-reduced-motion', /prefers-reduced-motion:\s*reduce/.test(css));
ok('Breakpoint tablet 768px', /min-width:\s*768px/.test(css));
ok('Breakpoint desktop 1100px', /min-width:\s*1100px/.test(css));
ok('Touch target >=44px (btn)', /min-height:\s*4[4-9]px/.test(css));
ok('Skip link ada', html.indexOf('skip-link') !== -1);
ok('Noscript ada', /<noscript>/.test(html));
ok('aria-live pada view', /id="view"[^>]*aria-live/.test(html));

// 4. app.js tidak diubah logikanya (tidak ada diff tak terduga vs commit)
const cp = require('child_process');
try {
  const diff = cp.execSync('git diff --stat -- app.js', { encoding: 'utf8' });
  ok('app.js tidak berubah di working tree', diff.trim() === '', diff.trim());
} catch (e) { ok('app.js tidak berubah di working tree', false, e.message); }

console.log('\n========================================');
console.log('HASIL VERIFIKASI UI: ' + pass + ' PASS, ' + fail + ' FAIL');
console.log('========================================');
process.exit(fail ? 1 : 0);
