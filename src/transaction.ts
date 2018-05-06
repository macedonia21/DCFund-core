import * as CryptoJS from 'crypto-js';
import * as ecdsa from 'elliptic';
import * as _ from 'lodash';

const ec = new ecdsa.ec('secp256k1');

enum TransType {
    DEPOSIT = 0,
    WITHDRAW = 1,
    LEND = 2,
    PAY = 3
}

class TxDCF {
    public wallet: string;
    public walletKey: string;
    public walletOwner: string;
    public amount: number;
    public month: number;
    public year: number;
    public type: number;
    public timestamp: number;

    constructor(wallet: string, walletKey: string, walletOwner: string, amount: number, month: number, year: number, type: number, timestamp: number) {
        this.wallet = wallet;
        this.walletKey = walletKey;
        this.walletOwner = walletOwner;
        this.amount = amount;
        this.month = month;
        this.year = year;
        this.type = type;
        this.timestamp = timestamp;
    }
}

class Transaction {
    public id: string;
    public txDCFs: TxDCF[];
    public isApproved: boolean;
    public signature: string;
}

const getTransactionId = (transaction: Transaction): string => {
    const txDCFContent: string = transaction.txDCFs
        .map((txDCF: TxDCF) => {
            return (
                txDCF.wallet + txDCF.walletKey + txDCF.walletOwner +
                txDCF.amount + txDCF.month + txDCF.year +
                txDCF.type + txDCF.timestamp);
        })
        .reduce((a, b) => a + b, '');

    return CryptoJS.SHA256(txDCFContent).toString();
};

const validateTransaction = (transaction: Transaction): boolean => {

    if (!isValidTransactionStructure(transaction)) {
        return false;
    }

    if (getTransactionId(transaction) !== transaction.id) {
        console.log('invalid tx id: ' + transaction.id);
        return false;
    }
    const hasValidTxDCFs: boolean = transaction.txDCFs
        .map((txDCF) => validateTxDCF(txDCF, transaction))
        .reduce((a, b) => a && b, true);

    if (!hasValidTxDCFs) {
        console.log('txDCFs are invalid in tx: ' + transaction.id);
        return false;
    }

    return true;
};
const hasDuplicates = (txDCFs: TxDCF[]): boolean => {
    const groups = _.countBy(txDCFs, (txDCF: TxDCF) => {
        return (
            txDCF.wallet + txDCF.walletKey + txDCF.walletOwner + txDCF.amount + txDCF.month + txDCF.year + txDCF.type
        );
    });
    return _(groups)
        .map((value, key) => {
            if (value > 1) {
                console.log('duplicate txDCF: ' + key);
                return true;
            } else {
                return false;
            }
        })
        .includes(true);
};

const validateTxDCF = (txDCF: TxDCF, transaction: Transaction): boolean => {
    return true;
};

const toHexString = (byteArray): string => {
    return Array.from(byteArray, (byte: any) => {
        return ('0' + (byte & 0xFF).toString(16)).slice(-2);
    }).join('');
};

const getPublicKey = (aPrivateKey: string): string => {
    return ec.keyFromPrivate(aPrivateKey, 'hex').getPublic().encode('hex');
};

const isValidTxDCFStructure = (txDCF: TxDCF): boolean => {
    if (txDCF == null) {
        console.log('txDCF is null');
        return false;
    } else if (typeof txDCF.wallet !== 'string') {
        console.log('invalid address type in txDCF');
        return false;
    } else if (!isValidAddress(txDCF.wallet)) {
        console.log('invalid DCF address in txDCF');
        return false;
    } else if (typeof txDCF.walletKey !== 'string') {
        console.log('invalid wallet key type in txDCF');
        return false;
    } else if (typeof txDCF.walletOwner !== 'string') {
        console.log('invalid owner type in txDCF');
        return false;
    } else if (typeof txDCF.amount !== 'number') {
        console.log('invalid amount type in txDCF');
        return false;
    } else if (typeof txDCF.month !== 'number') {
        console.log('invalid month type in txDCF');
        return false;
    } else if (typeof txDCF.year !== 'number') {
        console.log('invalid year type in txDCF');
        return false;
    } else if (typeof txDCF.type !== 'number') {
        console.log('invalid transaction type in txDCF');
        return false;
    } else {
        return true;
    }
};

const isValidTransactionStructure = (transaction: Transaction) => {
    if (typeof transaction.id !== 'string') {
        console.log('transactionId missing');
        return false;
    }
    if (!(transaction.txDCFs instanceof Array)) {
        console.log('invalid txDCFs type in transaction');
        return false;
    }
    if (!transaction.txDCFs
            .map(isValidTxDCFStructure)
            .reduce((a, b) => (a && b), true)) {
        return false;
    }

    return true;
};

// valid address is a valid ecdsa public key in the 04 + X-coordinate + Y-coordinate format
const isValidAddress = (address: string): boolean => {
    if (address.length !== 34) {
        console.log(address);
        console.log('invalid DCF address length');
        return false;
    } else if (address.match('^[a-zA-Z0-9]+$') === null) {
        console.log('DCF address must contain only alphanumeric characters');
        return false;
    } else if (!address.startsWith('d')) {
        console.log('DCF address must start with d');
        return false;
    }
    return true;
};

export {
    getTransactionId, isValidAddress, validateTransaction, Transaction, TransType, TxDCF
};
