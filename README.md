# Zkey Upload Server
The server works in tandem with the [Trusted Setup Ceremony](https://github.com/Nobody-Labs/trusted-setup) code to generate the zkey, as well as the [TwisterCash](https://twistercash.xyz/) website to upload the key. The order of contributions is enforced by the [Trusted Setup Coordinator](https://github.com/Nobody-Labs/ts-coordinator) contract on the Rinkarby testnet.

# Ethereum Authentication
The server uses Ethereum Web Tokens to authorize access. The Ethereum Web Token is a json web token that uses keccak256 for hashing messages and ecdsa secp256k1 for signing and verifying messages. This server uses the [ethers](https://github.com/ethers-io/ethers.js/) wallet implementation to sign and verify its own certificates. For the server to generate an ethereum web token, two conditions must be met:
  1. The client requesting authentication has provided a signed message containing its own address. That is, the recovered address from the signature must match the address signed in the message.
  2. The address specified by the client is the current contributor according to the TrustedSetupCoordinator contract that is live on the Rinkeby Arbitrum testnet. Only one individual ever has a valid signed certificate at a time. In the event that the network is down, then no access is given.

Upon these two conditions, the server issues a temporary ethereum web token that expires after X minutes or that expires after the contributor records their zkey contribution, whichever comes first. Contributors can request authorization again if their token expires before they complete the contribution.

## Ethereum Web Token Spec
The token follows the [specification of jwt](https://jwt.io/introduction), with some minor changes. The web token is divided into three parts, the header, payload, and signature. For this setup, the header is always the same:

  1. header
        ```json
        {
            "alg": "ETH256",
            "typ": "EWT"
        }
        ```

However the payload is dynamic according to the signer and the expiration time of the token.

  2. payload
        ```json
        {
            "signer": "0xbadc0de...",
            "expiry": 1123581321
        }
        ```

The signature is also dynamic, as it is composed from the data in the payload. It is a string, not a JSON object.

  3. signature
      ```json
      "0xadde8a09e80ae..."
      ```

The server encodes the token using base64url, where the characters `+/` are replaced with `-_`. The encoding is a string composed of the concatenation of the individual encoding of each part, as follows:

    token = encode(header) + "." + encode(payload) + "." + encode(signature)

For the header and payload, the encoding is `base64url.encode(JSON.stringify(data))`. For the signature, it is simply `base64url.encode(signature)`. An example token has this form:

    eyJhbGciOiJFVEgyNTYiLCJ0eXAiOiJFV1QifQ.eyJzaWduZXIiOiIweDE0NmU0YzNiNGE3NTk4MjNlNDY0RjBGN0E1MzY1ZjQ2OWY0ZDNmZDgiLCJleHBpcnkiOjE2Mzc5MjcwOTE4MDN9.MHg0NTliMzkwMDQ1NTdlNjU2ZDk4ZDI0NTA1NDI2ZDNmZDNjNDZkNTRkZmZlMDUxOTUzZTJmNTRlZmFjNjBjYzIxMWQwZGU0NDhiMzA2MmRjYTczMGM2ODYzNWYwNTBlMDhhNjljZGI4OWZjMDI5NjczZWE3YjZjMGJmZTdjNzVmNjFi

The message of the signature is composed from the concatenation of the base64url encodings of the header and payload separated by a single period.
```js
const message = keccak256(encode(header) + '.' + encode(payload));
const digest = keccak256("\x19Ethereum Signed Message:\n", message);
```

# SnarkJS
This server uses a custom logger to interrupt the SnarkJS verification process. Here's a peep into the code that SnarkJS uses for verifying a contribution:

```javascript
// source: https://github.com/iden3/snarkjs/blob/master/src/zkey_verify_fromr1cs.js
export default async function phase2verifyFromR1cs(r1csFileName, pTauFileName, zkeyFileName, logger) {

    // const initFileName = "~" + zkeyFileName + ".init";
    const initFileName = {type: "bigMem"};
    await newZKey(r1csFileName, pTauFileName, initFileName, logger);

    return await phase2verifyFromInit(initFileName, pTauFileName, zkeyFileName, logger);
}
```

Inside of `phase2verifyFromInit`, we focus on the functionality of the `logger` parameter. Notably, one function of the logger is to record the contribution hash, and we can see that it has a standard text format.

```javascript
// source: https://github.com/iden3/snarkjs/blob/master/src/zkey_verify_frominit.js#L221
for (let i=mpcParams.contributions.length-1; i>=0; i--) {
        const c = mpcParams.contributions[i];
        if (logger) logger.info("-------------------------");
        if (logger) logger.info(misc.formatHash(c.contributionHash, `contribution #${i+1} ${c.name ? c.name : ""}:`));
        if (c.type == 1) {
            if (logger) logger.info(`Beacon generator: ${misc.byteArray2hex(c.beaconHash)}`);
            if (logger) logger.info(`Beacon iterations Exp: ${c.numIterationsExp}`);
        }
    }
```

The [verifyingLogger](./src/verifyingLogger.ts) takes advantage of this by parsing the data passed to `logger.info` to find contribution hashes, then checking against the previous contribution hashes of the ceremony. This prevents a user from uploading a malicious contribution during the ceremony, allowing for a secure asynchronous, ordered trusted setup ceremony.

# Fleek
This server doesn't store zkeys except ephermerally until they are verified. For long term storage, the ceremony relies on fleek's IPFS service to hold the contributions.