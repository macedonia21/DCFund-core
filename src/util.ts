import * as bs58 from 'bs58';
import * as CryptoJS from 'crypto-js';

const hexToBinary = (s: string): string => {
    let ret: string = '';
    const lookupTable = {
        '0': '0000', '1': '0001', '2': '0010', '3': '0011', '4': '0100',
        '5': '0101', '6': '0110', '7': '0111', '8': '1000', '9': '1001',
        'a': '1010', 'b': '1011', 'c': '1100', 'd': '1101',
        'e': '1110', 'f': '1111'
    };
    for (let i: number = 0; i < s.length; i = i + 1) {
        if (lookupTable[s[i]]) {
            ret += lookupTable[s[i]];
        } else {
            return null;
        }
    }
    return ret;
};

const pubKeyToAddress = (publicKey: string): string => {
    // Perform SHA-256 hashing on the public key
    // const hashPubkey = CryptoJS.SHA256(CryptoJS.enc.Utf8.parse(publicKey));
    const hashPubkey = CryptoJS.SHA256(publicKey).toString();

    // Perform RIPEMD-160 hashing on the result of SHA-256
    const ripemdHashPubkey = CryptoJS.RIPEMD160(hashPubkey).toString();

    // Add version byte in front of RIPEMD-160 hash (0x00 for Main Network)
    const version = '5a';
    const prefixRipemdHashPubkey = version + ripemdHashPubkey;

    // Perform SHA-256 hash x2 times on the extended RIPEMD-160 result
    const checksumHash1 = CryptoJS.SHA256(prefixRipemdHashPubkey).toString();
    const checksumHash2 = CryptoJS.SHA256(checksumHash1).toString();
    const addressChecksum = checksumHash2.toString().substr(0, 8);

    // Add the 4 checksum bytes from stage 7 at the end of extended RIPEMD-160 hash from stage 4.
    // This is the 25-byte binary Bitcoin Address.
    const unencodedAddress = version + ripemdHashPubkey + addressChecksum;

    // Convert the result from a byte string into a base58 string using Base58Check encoding.
    // This is the most commonly used Bitcoin Address format
    const bytes = Buffer.from(unencodedAddress, 'hex');
    const address = bs58.encode(bytes);

    return address;
};

export {hexToBinary};
