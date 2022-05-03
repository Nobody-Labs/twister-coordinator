import dotenv from 'dotenv';
import * as ethers from 'ethers';
import Queue from 'bull';
import Redis from 'ioredis';
import Coordinator = require('../abi/TrustedSetupCoordinator.json');

dotenv.config();

const { REDIS_URL, COORDINATOR_KEY } = process.env;

const normalize = (addr: string): string => ethers.utils.getAddress(addr);

const redis = new Redis(REDIS_URL);
const contributionRecorder = new Queue('contributionRecorder', REDIS_URL || '');

contributionRecorder.process('contributionRecorder', async (job: Queue.Job, done: Queue.DoneCallback) => {
    const signer = job.data.signer;
    const contributionIpfsHash = job.data.contributionIpfsHash;
    const currentStatus = await redis.get(`status:${signer}`);
    console.log(signer);
    console.log(currentStatus);
    if (currentStatus === 'contribution completed') {
        console.log(contributionIpfsHash);
        try {
            const provider = new ethers.providers.JsonRpcProvider('https://rinkeby.arbitrum.io/rpc');
            const wallet = new ethers.Wallet(COORDINATOR_KEY || '0x', provider);
            const coordinator = new ethers.Contract(Coordinator.address, Coordinator.abi, wallet);
            const currentContributor = await coordinator.currentContributor();

            if (normalize(currentContributor) === normalize(signer)) {
                const tx = await coordinator.verifyContribution(signer, contributionIpfsHash);
                console.log(tx);
                await redis.set(`coordinatorTx:${signer}`, tx.hash);
            } else {
                const error = `Invalid contributor. Found: ${currentContributor} but expected ${signer}.`
                throw new Error(error);
            }

            done();
        } catch(err: any) {
            console.log(err);
            await redis.set(`status:${signer}`, 'final verification errored');
            done(new Error(err));
        }
    } else {
        console.log('status?');
    }
});

export async function addRecordJob(signer: string, contributionIpfsHash: string) {
    const contributionRecorderProducer = new Queue('contributionRecorder', REDIS_URL || '');
    console.log(signer, contributionIpfsHash);
    return contributionRecorderProducer.add('contributionRecorder', { signer, contributionIpfsHash });
}