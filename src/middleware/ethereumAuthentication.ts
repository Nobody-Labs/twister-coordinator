import express = require('express');
import base64url from 'base64url';
import ethers = require('ethers');
import dotenv = require('dotenv');
import Coordinator = require('../abi/TrustedSetupCoordinator.json');

dotenv.config();

const encode = base64url.encode;
const decode = base64url.decode;
const decodePayload = (payload: string): {signer: string, expiry: number} => JSON.parse(decode(payload));
const encodePayload = (payload: {signer: string, expiry: number}): string => encode(JSON.stringify(payload));
const encodeHeader = (header: {alg: string, typ: string}): string => encode(JSON.stringify(header));

const { PRIVATE_KEY } = process.env;
const wallet = new ethers.Wallet(PRIVATE_KEY || '0x');

const normalize = (addr: string): string => ethers.utils.getAddress(addr);
const keccak = (text: string) => ethers.utils.id(text);
const verifyMessage = (msg: string, sig: ethers.BytesLike) => ethers.utils.verifyMessage(ethers.utils.arrayify(msg), sig);
const signMessage = async (msg: string) => await wallet.signMessage(ethers.utils.arrayify(msg));

console.log(`Ethereum Authentication Signer: ${wallet.address}. The server only accepts bearer tokens signed by this address.`);

/**
 * @dev The current contributor is gathered from a smart contract on rinkarby testnet.
 */
const isCurrentContributor = async (address: string): Promise<boolean> => {
    const provider = new ethers.providers.JsonRpcProvider('https://rinkeby.arbitrum.io/rpc');
    const coordinator = new ethers.Contract(
       Coordinator.address,
       Coordinator.abi,
       provider
    );
    const currentContributor = await coordinator.currentContributor();
    return normalize(currentContributor) === normalize(address);
};

/**
 * @dev 
 */
export async function verifyEthAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
    const regex: RegExp = /^Bearer eyJhbGciOiJFVEgyNTYiLCJ0eXAiOiJFV1QifQ\.[-a-zA-Z0-9_]{104}\.[-a-zA-Z0-9_]{176}$/g;
    const token = req.headers.authorization;
    console.log(token);
    if (!token) {
        const error = new Error('Bearer Token Not In Headers');
        next(error);
        throw error;
    }
    if (!regex.test(token)) {
        const error = new Error('Invalid Bearer Token Format');
        next(error);
        throw error;
    }
    const [header, payload, signature] = token.split(' ')[1].split('.');
    const data: { signer: string, expiry: number } = decodePayload(payload);
    if (Date.now() > data.expiry) {
        const error = new Error('Ethereum Web Token Expired');
        next(error);
        throw error;
    }
    const message = keccak(header + '.' + payload);
    const issuer = verifyMessage(message, decode(signature));
    if (normalize(issuer) !== normalize(wallet.address)) {
        const error = new Error('Ethereum Web Token Invalid Signature');
        next(error);
        throw error;
    }
    const isContributor = await isCurrentContributor(data.signer); 
    if (!isContributor) {
        const error = new Error('Signer is not Current Contributor');
        next(error);
        throw error;
    }
    console.log(isContributor);
    next();
};

export async function generateEthAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
    const body: { signer: string, signature: string } = req.body; 
    const signer = body.signer;
    console.log(signer);
    const signature = body.signature;
    const addressMatcher: RegExp = /^0x[a-fA-f0-9]{40}$/g;
    const sigMatcher: RegExp = /^0x[a-fA-F0-9]{130}$/g;
    if (!addressMatcher.test(signer)) {
        const error = new Error('Invalid Signer');
        next(error);
        throw error;
    } else if (!sigMatcher.test(signature)) {
        const error = new Error('Invalid Signature');
        next(error);
        throw error;
    }
    const recovered = ethers.utils.verifyMessage(`Ethereum Authentication Request: ${normalize(signer)}`, signature);
    if (recovered !== normalize(signer)) {
        const error = new Error('Invalid Signer Recovered from Signature');
        next(error);
        throw error;
    }
    const isContributor = await isCurrentContributor(signer); 
    if (!isContributor) {
        const error = new Error('Signer is not Current Contributor');
        next(error);
        throw error;
    }
    const header = { 'alg': 'ETH256', 'typ': 'EWT' };
    // 1 day certs :^)
    // const payload = { signer, expiry: Date.now() + 86400000 };
    const payload = { signer, expiry: Date.now() + 3600000 };
    const message = keccak(encodeHeader(header) + '.' + encodePayload(payload));
    const authSignature = await signMessage(message);
    res.status(200).json({token: `${encodeHeader(header)}.${encodePayload(payload)}.${encode(authSignature)}`});
}
