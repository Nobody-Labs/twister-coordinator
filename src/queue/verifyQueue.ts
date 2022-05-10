import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import Queue from 'bull';
import Redis from 'ioredis';
import { zKey } from 'snarkjs';
import VerifyingLogger, { ContributionHashes } from '../util/verifyingLogger';
import { addUploadJob } from './uploadQueue';

dotenv.config();
const { REDIS_URL } = process.env;
const redis = new Redis(REDIS_URL);

const contributionVerifier = new Queue('contributionVerifier', REDIS_URL || '');

const getFile = (filename: string) => {
    return fs.readFileSync(path.resolve(__dirname, '..', '..', 'src', 'ceremony', filename));
};

const storeZkey = (contribution: any) => {
    return fs.writeFileSync(
        path.resolve(__dirname, '..', '..', 'zkeys', contribution.originalname),
        Buffer.from(contribution.buffer.data)
    );
};

const bufferToMem = (buffer: Buffer) => {
    return { type: 'mem', data: Buffer.from(buffer) };
};

contributionVerifier.process('contributionVerifier', async (job: Queue.Job, done: Queue.DoneCallback) => {

    const currentStatus = await redis.get(`status:${job.data.signer}`);

    if (currentStatus === 'pending verification') {
        console.log('verifying begin');

        const withdrawR1cs = bufferToMem(getFile('withdraw.r1cs'));
        const powersOfTau = bufferToMem(getFile('powersOfTau28_hez_final_15.ptau'));
        const circuitHash = await redis.get('withdraw.circuitHash');
        const contributionHashes = JSON.parse(await redis.get('withdraw.contributionHashes') || '{}');
        const zkeyData = bufferToMem(job.data.contribution.buffer.data);

        if (circuitHash && withdrawR1cs && powersOfTau && zkeyData
            && (Object.keys(contributionHashes).length > 0)) 
        {
            let newContributionHashes = contributionHashes;
            try {
                newContributionHashes = await verifyContributions(
                    withdrawR1cs,
                    powersOfTau,
                    zkeyData,
                    circuitHash,
                    contributionHashes
                );
                /** 
                 * @dev do not set `newTotal` member, as the next verification job relies on it 
                 * to be empty
                 * */
                await redis.set('withdraw.contributionHashes', JSON.stringify({ 
                    total: newContributionHashes.newTotal,
                    hashes: { ...newContributionHashes.hashes }
                }));
                await redis.set(`status:${job.data.signer}`, 'pending upload');

                try {
                    storeZkey(job.data.contribution);
                    console.log('successfully saved file locally');
                } catch(err) {
                    console.log(err);
                }

                const uploadJob = await addUploadJob(job.data.signer, job.data.contribution);
                await redis.set(`uploadJobId:${job.data.signer}`, uploadJob.id);
                done();
            } catch (err) {
                console.log(err);
                redis.set(`status:${job.data.signer}`, 'verification errored');
                done(new Error('verifyContributions'));
            }
        } else {
            redis.set(`status:${job.data.signer}`, 'verification errored');
            done(new Error('verifyContributions'));
        }
    }
});

async function verifyContributions(
    withdrawR1cs: {type: string, data: Buffer},
    powersOfTau: {type: string, data: Buffer},
    zkeyData: {type: string, data: Buffer},
    circuitHash: string,
    contributionHashes: ContributionHashes
): Promise<ContributionHashes> {
    const logger = new VerifyingLogger(circuitHash, contributionHashes);
    try {
        await zKey.verifyFromR1cs(withdrawR1cs, powersOfTau, zkeyData, logger);
    } catch (err: any) {
        throw new Error(`Verification Failed: ${err.message}`);
    }
    const newContributionHashes = logger.contributionHashes;
    console.log(newContributionHashes);

    if (newContributionHashes.newTotal) {
        return newContributionHashes;
    } else { throw new Error('Expected another contribution.') }
}

const contributionVerifierProducer = new Queue('contributionVerifier', REDIS_URL || '');

export async function addVerifyJob(signer: string, contribution: Express.Multer.File) {
    return contributionVerifierProducer.add('contributionVerifier', { signer, contribution });
}
