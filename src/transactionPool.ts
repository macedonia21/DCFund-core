import * as _ from 'lodash';
import {Transaction,
    // TxIn, UnspentTxOut,
    validateTransaction} from './transaction';

let transactionPool: Transaction[] = [];

const getTransactionPool = () => {
    return _.cloneDeep(transactionPool);
};

const getTransactionPoolForAddress = (address: string) => {
        return _.cloneDeep(transactionPool).filter((transaction) => {
            return transaction.txDCFs[0].wallet === address;
        });
};

const addToTransactionPool = (tx: Transaction) => {
    if (!validateTransaction(tx)) {
        throw Error('Trying to add invalid tx to pool');
    }

    if (!isValidTxForPool(tx, transactionPool)) {
        throw Error('Trying to add invalid tx to pool');
    }
    console.log('adding to txPool: %s', JSON.stringify(tx));
    transactionPool.push(tx);
};

const removeFromTransactionPool = (tx: Transaction) => {
    console.log('transPool removeFromTransactionPool');
    const removedTx = transactionPool.find((poolTx) => {
        return poolTx.id === tx.id;
    });
    const txIndex = transactionPool.indexOf(removedTx);
    console.log(transactionPool);
    console.log(tx);
    if (txIndex > -1) {
        console.log('remove from txPool: %s', JSON.stringify(tx));
        transactionPool.splice(txIndex, 1);
    }
};

// const hasTxIn = (txIn: TxIn, unspentTxOuts: UnspentTxOut[]): boolean => {
//     const foundTxIn = unspentTxOuts.find((uTxO: UnspentTxOut) => {
//         return uTxO.txOutId === txIn.txOutId && uTxO.txOutIndex === txIn.txOutIndex;
//     });
//     return foundTxIn !== undefined;
// };

const updateTransactionPool = (transactions: Transaction[]) => {
    const confirmedTxs = [];
    for (const poolTx of transactionPool) {
        for (const confirmTx of transactions) {
            if (confirmTx.id === poolTx.id) {
                confirmedTxs.push(poolTx);
                break;
            }
        }
    }
    if (confirmedTxs.length > 0) {
        console.log('removing the following transactions from txPool: %s', JSON.stringify(confirmedTxs));
        transactionPool = _.without(transactionPool, ...confirmedTxs);
    }
};

// const getTxPoolIns = (aTransactionPool: Transaction[]): TxIn[] => {
//     return _(aTransactionPool)
//         .map((tx) => tx.txIns)
//         .flatten()
//         .value();
// };

const isValidTxForPool = (tx: Transaction, aTtransactionPool: Transaction[]): boolean => {
    // const txPoolIns: TxIn[] = getTxPoolIns(aTtransactionPool);
//
//     const containsTxIn = (txIns: TxIn[], txIn: TxIn) => {
//         return _.find(txPoolIns, ((txPoolIn) => {
//             return txIn.txOutIndex === txPoolIn.txOutIndex && txIn.txOutId === txPoolIn.txOutId;
//         }));
//     };
//
//     for (const txIn of tx.txIns) {
//         if (containsTxIn(txPoolIns, txIn)) {
//             console.log('txIn already found in the txPool');
//             return false;
//         }
//     }
    return true;
};

export {
    addToTransactionPool,
    removeFromTransactionPool,
    getTransactionPool,
    getTransactionPoolForAddress,
    updateTransactionPool
};
