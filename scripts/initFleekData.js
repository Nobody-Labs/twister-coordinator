require('dotenv').config();
const fleekStorage = require('@fleekhq/fleek-storage-js');
const CircuitHash = require('../src/ceremony/circuitHash.json');
// const ContributionHashes = require('../src/ceremony/contributionHashes.json');

const { API_KEY, API_SECRET } = process.env;

const main = async () => {
    const uploadedCircuitHash = await fleekStorage.upload({
        apiKey: API_KEY,
        apiSecret: API_SECRET,
        key: 'withdrawCircuitHash.json',
        data: JSON.stringify(CircuitHash),
        httpUploadProgressCallback: (event) => {
          console.log(Math.round(event.loaded/event.total*100)+ '% done');
        }
    });
    console.log('uploadedCircuitHash', uploadedCircuitHash);

    // const uploadedContributionHashes = await fleekStorage.upload({
    //     apiKey: API_KEY,
    //     apiSecret: API_SECRET,
    //     key: 'withdrawContributionHashes.json',
    //     data: JSON.stringify(ContributionHashes),
    //     httpUploadProgressCallback: (event) => {
    //       console.log(Math.round(event.loaded/event.total*100)+ '% done');
    //     }
    // });
    // console.log('uploadedContributionHashes', uploadedContributionHashes);
}

main().then(() => process.exit()).catch(err => {
    console.error(err);
    process.exit();
})
