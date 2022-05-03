const circuitHashPattern: RegExp = /^Circuit Hash:.*\n(\t\t[a-f0-9]{8}\s[a-f0-9]{8}\s[a-f0-9]{8}\s[a-f0-9]{8}\n\t\t[a-f0-9]{8}\s[a-f0-9]{8}\s[a-f0-9]{8}\s[a-f0-9]{8}\n\t\t[a-f0-9]{8}\s[a-f0-9]{8}\s[a-f0-9]{8}\s[a-f0-9]{8}\n\t\t[a-f0-9]{8}\s[a-f0-9]{8}\s[a-f0-9]{8}\s[a-f0-9]{8})$/g;
const contributionHashPattern: RegExp = /^contribution #([0-9]{1,4}) (0x[a-fA-F0-9]{40})?:.*\n(\t\t[a-f0-9]{8}\s[a-f0-9]{8}\s[a-f0-9]{8}\s[a-f0-9]{8}\n\t\t[a-f0-9]{8}\s[a-f0-9]{8}\s[a-f0-9]{8}\s[a-f0-9]{8}\n\t\t[a-f0-9]{8}\s[a-f0-9]{8}\s[a-f0-9]{8}\s[a-f0-9]{8}\n\t\t[a-f0-9]{8}\s[a-f0-9]{8}\s[a-f0-9]{8}\s[a-f0-9]{8})$/g;

export interface ContributionHashes {
    total: number;
    hashes: { [index: string]: string };
    newTotal?: number;
}

const getHash = (data: string): string => {
    let hash = '0x';
    data.split('\n').map((chunk: string) =>
        chunk.replace('\t\t', '')
            .split(' ')
            .map(hex => hash += hex)
    );
    return hash;
};

class VerifyingLogger {
    circuitHash: string;
    contributionHashes: ContributionHashes;
    verbose: boolean;

    constructor(_circuitHash: string, _contributionHashes: ContributionHashes, _verbose: boolean = false) {
        if (_contributionHashes.newTotal) {
            throw new Error('unexpected newTotal on contributionHashes');
        }
        this.contributionHashes = _contributionHashes;
        this.circuitHash = _circuitHash;
        this.verbose = _verbose;
    }

    info(args: any) {
        const circuitMatch = circuitHashPattern.exec(args);
        if (circuitMatch) {
            const _circuitHash = getHash(circuitMatch[1]);
            if (_circuitHash !== this.circuitHash) {
                const err = `Invalid Circuit Hash\nFound:${_circuitHash}\nExpected: ${this.circuitHash}`;
                throw new Error(err);
            } else {
                if (this.verbose) console.log(`circuitHash: ${_circuitHash}`);
            }
        } else {
            const contributionMatch = contributionHashPattern.exec(args);
            if (contributionMatch) {
                const _index = Number(contributionMatch[1]);
                const _address = contributionMatch[2];
                const _hash = getHash(contributionMatch[3]);

                /** 
                 * @dev It's safe to assume that the index will increase by one each contribution,
                 * because the logger interrupts the `info` method as used in 
                 * `snarkjs.zKey.veryifyFromR1cs`, and it's hardcoded according to what it reads
                 * from the zkey file. We require the there is no `newTotal` field when this logger
                 * is instantiated, so if we find a number there, then we've already process one new
                 * contribution. It throws in that case, as it only allows one contribution at a time.
                 * The hash read from the zkey file must match the hashes stored in the logger, for 
                 * integrity of the contributions. This makes sure no contributor replaces N contributions
                 * with their own known inputs in the middle of the ceremony.
                 */
                if (_index > this.contributionHashes.total) {
                    if (this.contributionHashes.newTotal) {
                        const err = `Too many contributions.`;
                        throw new Error(err);
                    } else {
                        this.contributionHashes.newTotal = _index;
                        this.contributionHashes.hashes[_index.toString()] = _hash;
                    }
                } else if (_hash !== this.contributionHashes.hashes[_index.toString()]) {
                    console.log(_index);
                    console.log(this.contributionHashes);
                    const err = `Invalid Contribution Hash #${_index}\nFound:${_hash}\nExpected: ${this.contributionHashes.hashes[_index.toString()]}`;
                    throw new Error(err);
                } else {
                    if (this.verbose) {
                        if (_address) {
                            console.log(`contributor: ${_address}`);
                        }
                        console.log(`contributionIndex: ${_index}`);
                        console.log(`contributionHash: ${_hash}`);
                    }
                }
            } else {
                if (this.verbose) console.info(args);
            }
        }
    }

    log(args: any) { if (this.verbose) console.log(args) }
    error(args: any) { if (this.verbose) console.error(args) }
    debug(args: any) { if (this.verbose) console.debug(args) }
}

export default VerifyingLogger;
