// Test parsing angka format Indonesia untuk HitungUsaha
// Jalankan: node num.test.js

function num(v) {
  if (v == null) return 0;
  var s = String(v).trim();
  if (!s) return 0;
  if (s.charAt(0) === '-') return 0;
  s = s.replace(/[^0-9.,]/g, '');
  if (!s) return 0;
  var hasDot = s.indexOf('.') !== -1, hasComma = s.indexOf(',') !== -1;
  if (hasDot && hasComma) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.split('.').join('').replace(',', '.');
    else s = s.split(',').join('');
  } else if (hasComma) {
    var cp = s.split(',');
    s = cp.length > 2 ? cp.join('') : s.replace(',', '.');
  } else if (hasDot) {
    var dp = s.split('.');
    if (dp.length > 2) s = dp.join('');
    else if (dp[1] && dp[1].length === 3 && /^[1-9][0-9]{0,2}$/.test(dp[0])) s = dp.join('');
  }
  var n = parseFloat(s);
  return isNaN(n) || !isFinite(n) ? 0 : Math.max(0, n);
}

var cases = [
  ['50.000', 50000],
  ['50000', 50000],
  ['1.500.000', 1500000],
  ['1,5', 1.5],
  ['2.500,75', 2500.75],
  ['Rp 75.000', 75000],
  ['abc', 0],
  ['', 0],
  ['0', 0],
  ['1000', 1000],
  ['12,5', 12.5]
];

var ok = true;
cases.forEach(function (c) {
  var r = num(c[0]);
  var pass = r === c[1];
  if (!pass) ok = false;
  console.log((pass ? 'PASS' : 'FAIL') + ' num("' + c[0] + '")=' + r + ' expected ' + c[1]);
});
console.log(ok ? 'ALL PASS' : 'SOME FAILED');
process.exit(ok ? 0 : 1);
