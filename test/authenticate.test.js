// const fs = require('fs');
// const axios = require('axios');
// const ethers = require('ethers');

// const main = async () => {
//   const wallet = ethers.Wallet.createRandom();
//   const signer = await wallet.getAddress();

//   const message = `Ethereum Authentication Request: ${signer}`;
//   const signature = await wallet.signMessage(message);

//   console.log(`signer: ${signer}`);
//   console.log(`signature: ${signature}`);
//   const response = await axios.post('http://localhost:8080/generateEthAuth', {
//     signer,
//     signature
//     },
//   ).catch(err => {
//     throw new Error(err.response.data.error);
//   });
//   fs.writeFileSync('ewt_token.json', JSON.stringify(response.data, null, 4));
// };

// main().then(() => process.exit(0)).catch(err => {
//   console.error(`Error: ${err.message}`);
//   process.exit(1);
// });
