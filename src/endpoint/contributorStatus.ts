import dotenv from 'dotenv';
import express from 'express';
import Queue from 'bull';
import Redis from 'ioredis';

dotenv.config();

const { REDIS_URL } = process.env;

const redis = new Redis(REDIS_URL);

interface ContributorStatus {
    status: string;
    data?: string | null;
}

const getStatus = async (signer: string): Promise<ContributorStatus> => {
    const status = await redis.get(`status:${signer}`);
    console.log(status);
    switch (status) {
        case 'pending verification': {
            const queue = new Queue('contributionVerifier', REDIS_URL || '');
            const verifyJobId = await redis.get(`verifyJobId:${signer}`);
            const job = await queue.getJob(verifyJobId as Queue.JobId);
            console.log(job);
            return {status};
        }

        case 'verification errored': {
            const queue = new Queue('contributionVerifier', REDIS_URL || '');
            const verifyJobId = await redis.get(`verifyJobId:${signer}`);
            const job = await queue.getJob(verifyJobId as Queue.JobId);
            console.log(job);
            return {status, data: job?.id.toString()};
        }

        case 'pending upload' : {
            const queue = new Queue('contributionUploader', REDIS_URL || '');
            const uploadJobId = await redis.get(`uploadJobId:${signer}`);
            const job = await queue.getJob(uploadJobId as Queue.JobId);
            console.log(job);
            return {status};
        }

        case 'upload errored': {
            const queue = new Queue('contributionUploader', REDIS_URL || '');
            const uploadJobId = await redis.get(`uploadJobId:${signer}`);
            const job = await queue.getJob(uploadJobId as Queue.JobId);
            console.log(job);
            return {status, data: job?.id.toString()};
        }

        case 'contribution completed': {
            const publicUrl = await redis.get(`contribution:${signer}`);
            console.log(publicUrl);
            return {status, data: publicUrl};
        }

        default: {
            return { status: 'unknown' };
        }
        
    }
}

async function contributorStatus(req: express.Request, res: express.Response, next: express.NextFunction) {
    console.log(req.body);
    const signer = req.body.signer;    
    console.log('signer:', signer);
    const status = await getStatus(signer);
    res.status(200).json(status);
}

export default contributorStatus;