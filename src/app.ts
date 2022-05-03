import express = require('express');
import cors = require('cors');
import bodyParser = require('body-parser');

import memoryUpload from './middleware/memoryUpload';
import {
    verifyEthAuth,
    generateEthAuth
} from './middleware/ethereumAuthentication';

import processUpload from './endpoint/processUpload';
import contributorStatus from './endpoint/contributorStatus';

/**
 * @dev production will specify cors
 * I think limiting to requests from https://twistercash.xyz would be best
 * the UI itself will do a zkey verification before the user can upload the file
 * however the server still needs to do its own verification in case a malicious
 * user modifies the source code in their browser
 */
const app = express();
app.use(cors());

/**
 * @dev authentication is only granted to the current contributor according to the 
 * trusted setup coordinator contract, and is only valid while they are the contributor
 * 
 * here I use bodyParser.json() exclusively, because another endpoint uses multer which
 * is for receiving multipart/formdata requests, and I don't want json parsing for that (!?)
 */
app.post('/generateEthAuth', bodyParser.json(), generateEthAuth);


/**
 * @dev this does the following actions, assuming no failures:
 *     1. checks ethereum authentication scheme
 *     2. receives file from request
 *     3. starts verification job for zkey
 *     4. writes response to client that the request was accepted
 *     5. after verification, starts upload job to fleek's IPFS
 *     6. after uploading, sets signers final state to confirmed
 * processUpload starts a verifyJob. the verifyJob starts an upload job, if its successful.
 * doing it this way means i don't have to pass the data along in the request body anymore,
 * because it is saved in redis (via the bull queue), which makes the data recoverable and
 * the job repeatable if it fails, even after the request ends.
 */
app.options('/uploadZkey', cors() as any); // enable preflight for this endpoint
app.post('/uploadZkey', verifyEthAuth, memoryUpload, processUpload);

/**
 * @dev the client can use the signer's address to get status of the pipeline
 */
app.post('/status', bodyParser.json(), contributorStatus);

// catch any errors, send generic error response back to client
app.use((
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
) => {
    if (err) {
        console.log(err);
        if (!res.headersSent) {
            res.status(500).send('There was an error processing the request.');
        }
    }
});

export default app;
