const { Keypair } = require('@solana/web3.js');
const fs = require('fs');

const keypair = Keypair.generate();
const secretArray = Array.from(keypair.secretKey);

fs.writeFileSync(
  'irys-wallet.json',
  JSON.stringify(secretArray)
);

console.log('New wallet created.');
console.log('Public address:', keypair.publicKey.toBase58());
console.log('Secret saved to irys-wallet.json');