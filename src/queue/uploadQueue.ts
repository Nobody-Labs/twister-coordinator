import dotenv from 'dotenv';
import Queue from 'bull';
import Redis from 'ioredis';
import fleekStorage from '@fleekhq/fleek-storage-js';
import { addRecordJob } from './recordContributionQueue';

dotenv.config();

const {
    API_KEY,
    API_SECRET,
    REDIS_URL
} = process.env;

const redis = new Redis(REDIS_URL);
const contributionUploader = new Queue('contributionUploader', REDIS_URL || '');

contributionUploader.process('contributionUploader', async (job: Queue.Job, done: Queue.DoneCallback) => {
    const signer = job.data.signer;
    const contribution = job.data.contribution;
    const currentStatus = await redis.get(`status:${signer}`);

    if (currentStatus === 'pending upload') {
        console.log(contribution);
        try {
            const uploadedFile = await fleekStorage.upload({
                apiKey: API_KEY || '',
                apiSecret: API_SECRET || '',
                key: contribution.originalname,
                data: Buffer.from(contribution.buffer.data)
            });
            const contributionHashes = await redis.get('withdraw.contributionHashes');
            const uploadedContributionHashes = await fleekStorage.upload({
                apiKey: API_KEY || '',
                apiSecret: API_SECRET || '',
                key: 'withdrawContributionHashes.json',
                data: contributionHashes
            })
            console.log(`contributionHashes updated: ${uploadedContributionHashes.publicUrl}`);

            await redis.set(`status:${signer}`, 'contribution completed');
            await redis.set(`contribution:${signer}`, uploadedFile.publicUrl);

            const recordJob = await addRecordJob(signer, uploadedFile.hash);
            console.log(recordJob);
            await redis.set(`recordJobId:${signer}`, recordJob.id);
            done();
        } catch(err: any) {
            console.log(err);
            await redis.set(`status:${signer}`, 'upload errored');
            done(new Error(err));
        }
    }
});

const contributionUploaderProducer = new Queue('contributionUploader', REDIS_URL || '');

export async function addUploadJob(signer: string, contribution: Express.Multer.File) {
    return contributionUploaderProducer.add('contributionUploader', { signer, contribution });
}
