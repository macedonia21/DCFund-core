import * as CryptoJS from 'crypto-js';
import * as ecdsa from 'elliptic';
import * as loadJsonFile from 'load-json-file';
import * as _ from 'lodash';
import {broadcastLatest, broadCastTransactionPool} from './p2p';
import {
    getTransactionId, Transaction, TransType, TxDCF, validateBlockTransactions
} from './transaction';
import {
    addToTransactionPool, getTransactionPool, removeFromTransactionPool, updateTransactionPool
} from './transactionPool';
import {hexToBinary} from './util';
import {createTransaction} from './wallet';

// Fund key file path
const FUND_KEY: string = 'node/wallet/fund.json';
const ec = new ecdsa.ec('secp256k1');

class Balance {
    public wallet: string;
    public deposit: number;
    public lend: number;

    constructor(wallet: string, deposit: number, lend: number) {
        this.wallet = wallet;
        this.deposit = deposit;
        this.lend = lend;
    }
}

class Block {
    public index: number;
    public hash: string;
    public previousHash: string;
    public timestamp: number;
    public data: Transaction[];
    public balances: Balance[];
    public difficulty: number;
    public nonce: number;

    constructor(index: number, hash: string, previousHash: string,
                timestamp: number, data: Transaction[], blockBalances: Balance[], difficulty: number, nonce: number) {
        this.index = index;
        this.previousHash = previousHash;
        this.timestamp = timestamp;
        this.data = data;
        this.balances = blockBalances;
        this.hash = hash;
        this.difficulty = difficulty;
        this.nonce = nonce;
    }
}

const calculateHashForBlock = (block: Block): string =>
    calculateHash(block.index, block.previousHash, block.timestamp, block.data, block.balances, block.difficulty, block.nonce);

const calculateHash = (index: number, previousHash: string, timestamp: number, data: Transaction[],
                       blockBalances: Balance[], difficulty: number, nonce: number): string =>
    CryptoJS.SHA256(index + previousHash + timestamp + data + balances + difficulty + nonce).toString();

const fundAddress = loadJsonFile.sync(FUND_KEY).address;
const fundPubKey = loadJsonFile.sync(FUND_KEY).publicKey;
const genesisFundBalance = 300;
const genesisTransaction = {
    'id': '',
    'txDCFs': [{
        'wallet': 'dUAenXe1YurRzDD35GgnyqoTDTfjMrhhDm',
        'walletKey': '04752e4afbe121db17bd570981f8a3ca14916378685869951fb56367b416d3f672f6f356a6d0cf55cff5a49bcb1285f461f58120942b7d004140c51fc2ad1ca72b',
        'walletOwner': 'Coinbase Faucet',
        'amount': genesisFundBalance,  // Cutover amount
        'month': 5, // Cutover month
        'year': 2018, // Cutover year
        'type': TransType.DEPOSIT,
        'timestamp': new Date().getTime()
    }],
    'isApproved': true,
    'signature': ''
};
genesisTransaction.id = getTransactionId(genesisTransaction);

const genesisTimestamp = new Date().getTime();
const genesisBalance = new Balance(fundAddress, genesisFundBalance, 0);
const balances: Balance[] = [genesisBalance];
const genesisBlock: Block = new Block(
    0, '', '', genesisTimestamp, [genesisTransaction], balances, 0, 0
);
genesisBlock.hash = calculateHashForBlock(genesisBlock);

let blockchain: Block[] = [genesisBlock];

const getBlockchain = (): Block[] => blockchain;

const getLatestBlock = (): Block => blockchain[blockchain.length - 1];

// in seconds
const BLOCK_GENERATION_INTERVAL: number = 10;

// in blocks
const DIFFICULTY_ADJUSTMENT_INTERVAL: number = 10;

const getDifficulty = (aBlockchain: Block[]): number => {
    const latestBlock: Block = aBlockchain[blockchain.length - 1];
    if (latestBlock.index % DIFFICULTY_ADJUSTMENT_INTERVAL === 0 && latestBlock.index !== 0) {
        return getAdjustedDifficulty(latestBlock, aBlockchain);
    } else {
        return latestBlock.difficulty;
    }
};

const getAdjustedDifficulty = (latestBlock: Block, aBlockchain: Block[]) => {
    const prevAdjustmentBlock: Block = aBlockchain[blockchain.length - DIFFICULTY_ADJUSTMENT_INTERVAL];
    const timeExpected: number = BLOCK_GENERATION_INTERVAL * DIFFICULTY_ADJUSTMENT_INTERVAL;
    const timeTaken: number = latestBlock.timestamp - prevAdjustmentBlock.timestamp;
    if (timeTaken < timeExpected / 2) {
        return prevAdjustmentBlock.difficulty + 1;
    } else if (timeTaken > timeExpected * 2) {
        return (prevAdjustmentBlock.difficulty > 0 ? prevAdjustmentBlock.difficulty - 1 : 0);
    } else {
        return prevAdjustmentBlock.difficulty;
    }
};

const generateRawNextBlock = (blockData: Transaction[], isApproved: boolean) => {
    const previousBlock: Block = getLatestBlock();
    const difficulty: number = getDifficulty(getBlockchain());
    const nextIndex: number = previousBlock.index + 1;
    const nextTimestamp: number = new Date().getTime();
    // Logic to update balance based on Transaction[]
    const blockBalances = _.cloneDeep(previousBlock.balances);

    if (isApproved) {
        const fundBalance = blockBalances.find((eachBalance) => {
            return eachBalance.wallet === fundAddress;
        });
        for (const tx of blockData) {
            for (const txDCF of tx.txDCFs) {
                let balance = blockBalances.find((eachBalance) => {
                    return eachBalance.wallet === txDCF.wallet;
                });
                if (balance) {
                    updateBalance(txDCF, balance, fundBalance);
                } else {
                    balance = new Balance(txDCF.wallet, 0, 0);
                    updateBalance(txDCF, balance, fundBalance);
                    blockBalances.push(balance);
                }
            }
        }
    }
    const newBlock: Block = findBlock(nextIndex, previousBlock.hash, nextTimestamp, blockData, blockBalances, difficulty);
    if (addBlockToChain(newBlock)) {
        broadcastLatest();
        return newBlock;
    } else {
        return null;
    }

};

const updateBalance = (txDCF: TxDCF, userBalance: Balance, fundBalance: Balance) => {
    if (txDCF.type === TransType.DEPOSIT) {
        userBalance.deposit = userBalance.deposit + txDCF.amount;
        fundBalance.deposit = fundBalance.deposit + txDCF.amount;
    } else if (txDCF.type === TransType.WITHDRAW) {
        userBalance.deposit = userBalance.deposit - txDCF.amount;
        fundBalance.deposit = fundBalance.deposit - txDCF.amount;
    } else if (txDCF.type === TransType.LEND) {
        userBalance.lend = userBalance.lend + txDCF.amount;
        fundBalance.lend = fundBalance.lend + txDCF.amount;
    } else if (txDCF.type === TransType.PAY) {
        userBalance.lend = userBalance.lend - txDCF.amount;
        fundBalance.lend = fundBalance.lend - txDCF.amount;
    }
};

const generateNextBlock = (txId: string, signature: string, isApproved: boolean) => {
    const blockData: Transaction[] = getTransactionPool().filter((transaction) => {
        return transaction.id === txId;
    });
    if (!blockData || blockData.length === 0) {
        return null;
    }

    const key = ec.keyFromPublic(fundPubKey, 'hex');
    const validSignature: boolean = key.verify(txId, signature);
    if (!validSignature) {
        return null;
    } else {
        blockData[0].signature = signature;
        blockData[0].isApproved = isApproved;
    }
    return generateRawNextBlock(blockData, isApproved);
};

const findBlock = (index: number, previousHash: string, timestamp: number, data: Transaction[], blockBalances: Balance[],
                   difficulty: number): Block => {
    let nonce = 0;
    while (true) {
        const hash: string = calculateHash(index, previousHash, timestamp, data, blockBalances, difficulty, nonce);
        if (hashMatchesDifficulty(hash, difficulty)) {
            return new Block(index, hash, previousHash, timestamp, data, blockBalances, difficulty, nonce);
        }
        nonce++;
    }
};

const getBalances = (): Balance[] => {
    const lastestBlock: Block = getLatestBlock();
    return lastestBlock.balances;
};

const getAccountBalance = (address: string): Balance => {
    const lastestBlock: Block = getLatestBlock();
    let balance = _.find(lastestBlock.balances, (eachBalance: Balance) => {
        return eachBalance.wallet === address;
    });
    if (!balance) {
        balance = new Balance(address, 0, 0);
    }
    return balance;
};

const sendTransaction = (wallet: string, walletKey: string, walletOwner: string, amount: number, month: number, year: number, type: TransType): Transaction => {
    console.log('blockchain sendTransaction');
    const tx: Transaction = createTransaction(wallet, walletKey, walletOwner, amount, month, year, type);
    addToTransactionPool(tx);
    broadCastTransactionPool();
    return tx;
};

const removeTransaction = (txId: string, signature: string): boolean => {
    console.log('blockchain sendTransaction');

    const tx: Transaction = getTransactionPool().find((transaction: Transaction) => {
        return transaction.id === txId;
    });
    if (!tx) {
        return false;
    } else {
        const walletKey = tx.txDCFs[0].walletKey;
        const key = ec.keyFromPublic(walletKey, 'hex');
        const validSignature = key.verify(txId, signature);
        console.log(validSignature);
        if (!validSignature) {
            return false;
        }
    }
    removeFromTransactionPool(tx);
    broadCastTransactionPool();
    return true;
};

const isValidBlockStructure = (block: Block): boolean => {
    return typeof block.index === 'number'
        && typeof block.hash === 'string'
        && typeof block.previousHash === 'string'
        && typeof block.timestamp === 'number'
        && typeof block.data === 'object';
};

const isValidNewBlock = (newBlock: Block, previousBlock: Block): boolean => {
    console.log('isValidNewBlock');
    if (!isValidBlockStructure(newBlock)) {
        console.log('invalid block structure: %s', JSON.stringify(newBlock));
        return false;
    }
    if (previousBlock.index + 1 !== newBlock.index) {
        console.log('invalid index');
        return false;
    } else if (previousBlock.hash !== newBlock.previousHash) {
        console.log('invalid previoushash');
        return false;
    } else if (!isValidTimestamp(newBlock, previousBlock)) {
        console.log('invalid timestamp');
        return false;
    } else if (!hasValidHash(newBlock)) {
        return false;
    }
    return true;
};

const getAccumulatedDifficulty = (aBlockchain: Block[]): number => {
    return aBlockchain
        .map((block) => block.difficulty)
        .map((difficulty) => Math.pow(2, difficulty))
        .reduce((a, b) => a + b);
};

const isValidTimestamp = (newBlock: Block, previousBlock: Block): boolean => {
    return ( previousBlock.timestamp - 60 < newBlock.timestamp )
        && newBlock.timestamp - 60 < new Date().getTime();
};

const hasValidHash = (block: Block): boolean => {

    if (!hashMatchesBlockContent(block)) {
        console.log('invalid hash, got:' + block.hash);
        return false;
    }

    if (!hashMatchesDifficulty(block.hash, block.difficulty)) {
        console.log('block difficulty not satisfied. Expected: ' + block.difficulty + 'got: ' + block.hash);
    }
    return true;
};

const hashMatchesBlockContent = (block: Block): boolean => {
    const blockHash: string = calculateHashForBlock(block);
    return blockHash === block.hash;
};

const hashMatchesDifficulty = (hash: string, difficulty: number): boolean => {
    const hashInBinary: string = hexToBinary(hash);
    const requiredPrefix: string = '0'.repeat(difficulty);
    return hashInBinary.startsWith(requiredPrefix);
};

// Checks if the given blockchain is valid.
const isValidChain = (blockchainToValidate: Block[]): boolean => {
    const isValidGenesis = (block: Block): boolean => {
        return JSON.stringify(block) === JSON.stringify(genesisBlock);
    };
    if (!isValidGenesis(blockchainToValidate[0])) {
        return false;
    }
    for (let i = 0; i < blockchainToValidate.length; i++) {
        const currentBlock: Block = blockchainToValidate[i];
        if (i !== 0 && !isValidNewBlock(blockchainToValidate[i], blockchainToValidate[i - 1])) {
            return false;
        }
        if (!validateBlockTransactions(currentBlock.data, currentBlock.index)) {
            console.log('invalid block transactions');
            return false;
        }
    }
    return true;
};

const addBlockToChain = (newBlock: Block): boolean => {
    console.log('addBlockToChain');
    if (isValidNewBlock(newBlock, getLatestBlock())) {
        blockchain.push(newBlock);
        updateTransactionPool(newBlock.data);
        return true;
    }
    return false;
};

const replaceChain = (newBlocks: Block[]) => {
    const validChain = isValidChain(newBlocks);
    if (validChain &&
        getAccumulatedDifficulty(newBlocks) > getAccumulatedDifficulty(getBlockchain())) {
        console.log('Received blockchain is valid. Replacing current blockchain with received blockchain');
        blockchain = newBlocks;
        broadcastLatest();
    } else {
        console.log('Received blockchain invalid');
    }
};

const handleReceivedTransaction = (transaction: Transaction) => {
    addToTransactionPool(transaction);
};

export {
    Balance,
    Block,
    getBlockchain,
    getLatestBlock,
    sendTransaction,
    removeTransaction,
    generateRawNextBlock,
    generateNextBlock,
    handleReceivedTransaction,
    getBalances,
    getAccountBalance,
    isValidBlockStructure,
    replaceChain,
    addBlockToChain
};
