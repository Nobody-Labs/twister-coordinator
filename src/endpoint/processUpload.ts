import express from 'express';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import { addVerifyJob } from '../queue/verifyQueue';

dotenv.config();

const redis = new Redis(process.env.REDIS_URL);

async function processUpload(req: express.Request, res: express.Response, next: express.NextFunction) {
    const signer = req.body.signer;    
    console.log('signer:', signer);
    const status = await redis.get(`status:${signer}`);
    if (status !== 'contribution completed') {
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        const contribution = files.contribution[0] as Express.Multer.File;
        console.log(contribution);
        const verifyJob = await addVerifyJob(signer, contribution);
        await redis.set(`status:${signer}`, 'pending verification');
        await redis.set(`verifyJobId:${signer}`, verifyJob.id);
        res.status(200).json({id: verifyJob.id});
        next();
    } else {
        const err = `contributor ${signer} has already completed the ceremony`;
        next(new Error(err));
    }
}

export default processUpload;