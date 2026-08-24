const fs = require('fs');
const p = 'node_modules/@stellar/stellar-sdk/lib/transaction_builder.d.ts';
if (!fs.existsSync(p)) {
  console.log('File not found at: ' + p);
  // Try alternative paths
  const alt = 'backend/node_modules/@stellar/stellar-sdk/lib/transaction_builder.d.ts';
  if (fs.existsSync(alt)) {
    console.log('Found at: ' + alt);
    const s = fs.readFileSync(alt, 'utf8');
    const i = s.indexOf('buildFeeBumpTransaction');
    console.log(i >= 0 ? s.substring(Math.max(0, i - 200), i + 400) : 'not found in alt');
  } else {
    console.log('Not found at alt either');
  }
} else {
  const s = fs.readFileSync(p, 'utf8');
  const i = s.indexOf('buildFeeBumpTransaction');
  console.log(i >= 0 ? s.substring(Math.max(0, i - 200), i + 400) : 'not found');
}