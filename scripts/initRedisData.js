require('dotenv').config();
const Redis = require('ioredis');
const fleekStorage = require('@fleekhq/fleek-storage-js');

const { API_KEY, API_SECRET, REDIS_URL } = process.env;

const main = async () => {
    const redis = new Redis(REDIS_URL);
    console.log('initializing redis db');
    console.log('checking redis db for circuit and hash data');

    const circuit = await redis.get('withdraw.circuitHash');
    const hashes = await redis.get('withdraw.contributionHashes');

    if (!circuit) {
        console.log('circuit not found. retrieving from fleek');
        const circuitHash = await fleekStorage.get({
            apiKey: API_KEY,
            apiSecret: API_SECRET,
            key: 'withdrawCircuitHash.json'
        });
        console.log('circuitHash: ', JSON.parse(circuitHash.data.toString()).circuitHash);
        await redis.set('withdraw.circuitHash', JSON.parse(circuitHash.data.toString()).circuitHash);
    } else {
        console.log('circuitHash data recovered: ', circuit);
    }

    if (!hashes) {
        const contributionHashes = await fleekStorage.get({
            apiKey: API_KEY,
            apiSecret: API_SECRET,
            key: 'withdrawContributionHashes.json'
        });

        console.log('contributionHashes: ', JSON.parse(contributionHashes.data.toString()));
        await redis.set('withdraw.contributionHashes', contributionHashes.data.toString());
    } else {
        console.log('contributionHashes recovered: ', JSON.parse(hashes));
    }
}

main().then(() => process.exit()).catch(err => {
    console.error(err);
    process.exit();
})
