import {ec} from 'elliptic';
import {getTransactionId, Transaction, TransType, TxDCF} from './transaction';

const createTransaction = (wallet: string, walletKey: string, walletOwner: string,
                           amount: number, month: number, year: number, type: TransType): Transaction => {
    const unsignedTxDCF: TxDCF = new TxDCF(wallet, walletKey, walletOwner, amount, month, year, type, new Date().getTime());

    const tx: Transaction = new Transaction();
    tx.txDCFs = [unsignedTxDCF];
    tx.id = getTransactionId(tx);
    tx.isApproved = null;
    tx.signature = '';
    console.log(tx);
    return tx;
};

export {
    createTransaction,
};
