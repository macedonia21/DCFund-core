import * as bodyParser from 'body-parser';
import * as express from 'express';
import * as _ from 'lodash';
import {
    Balance, Block, generateNextBlock, generateRawNextBlock, getAccountBalance, getBalances,
    getBlockchain, removeTransaction, sendTransaction
} from './blockchain';
import {connectToPeers, getSockets, initP2PServer} from './p2p';
import {Transaction} from './transaction';
import {getTransactionPool, getTransactionPoolForAddress} from './transactionPool';

const httpPort: number = parseInt(process.env.HTTP_PORT) || 3001;
const p2pPort: number = parseInt(process.env.P2P_PORT) || 6001;

const initHttpServer = (myHttpPort: number) => {
    const app = express();
    app.use(bodyParser.json());

    app.use((err, req, res, next) => {
        if (err) {
            res.status(400).send(err.message);
        }
    });

    app.get('/blocks', (req, res) => {
        res.send(getBlockchain());
    });

    app.get('/block/:hash', (req, res) => {
        const block = _.find(getBlockchain(), {'hash' : req.params.hash});
        res.send(block);
    });

    app.get('/transaction/:id', (req, res) => {
        const tx = _(getBlockchain())
            .map((blocks) => blocks.data)
            .flatten()
            .find({'id': req.params.id});
        res.send(tx);
    });

    app.get('/address/:address', (req, res) => {
        const address = req.params.address;
        const transactions =
            _(getBlockchain())
                .map((blocks) => blocks.data)
                .flatten()
                .filter((tx: Transaction) => {
                    return tx.txDCFs[0].wallet === address;
                });
        res.send(transactions);
    });

    app.post('/mineRawBlock', (req, res) => {
        if (req.body.data == null) {
            res.send('data parameter is missing');
            return;
        }
        const newBlock: Block = generateRawNextBlock(req.body.data, false);
        if (newBlock === null) {
            res.status(400).send('could not generate block');
        } else {
            res.send(newBlock);
        }
    });

    app.post('/confirmBlock', (req, res) => {
        console.log('mineBlock');
        const txId = req.body.txId;
        const signature = req.body.signature;
        const isApproved = req.body.isApproved;
        const newBlock: Block = generateNextBlock(txId, signature, isApproved);
        if (newBlock === null) {
            res.status(400).send('could not generate block');
        } else {
            res.send(newBlock);
        }
    });

    app.get('/balances', (req, res) => {
        const balances: Balance[] = getBalances();
        res.send(balances);
    });

    app.get('/balance/:address', (req, res) => {
        const address = req.params.address;
        const balance: Balance[] = getAccountBalance(address);
        res.send(balance);
    });

    app.post('/sendTransaction', (req, res) => {
        try {
            const wallet = req.body.wallet;
            const walletKey = req.body.walletKey;
            const walletOwner = req.body.walletOwner;
            const amount = req.body.amount;
            const month = req.body.month;
            const year = req.body.year;
            const type = req.body.type;

            if (wallet === undefined || amount === undefined || type === undefined) {
                throw Error('invalid address or amount');
            }
            const resp = sendTransaction(wallet, walletKey, walletOwner, amount, month, year, type);
            res.send(resp);
        } catch (e) {
            console.log(e.message);
            res.status(400).send(e.message);
        }
    });

    app.post('/removeTransaction', (req, res) => {
        try {
            const txId = req.body.txId;
            const signature = req.body.signature;

            if (txId === undefined || signature === undefined) {
                throw Error('invalid transaction or signature');
            }
            const resp = removeTransaction(txId, signature);
            res.send(resp);
        } catch (e) {
            console.log(e.message);
            res.status(400).send(e.message);
        }
    });

    app.get('/transactionPool', (req, res) => {
        res.send(getTransactionPool());
    });

    app.get('/transactionPool/:address', (req, res) => {
        const address = req.params.address;
        res.send(getTransactionPoolForAddress(address));
    });

    app.get('/peers', (req, res) => {
        res.send(getSockets().map((s: any) => s._socket.remoteAddress + ':' + s._socket.remotePort));
    });
    app.post('/addPeer', (req, res) => {
        connectToPeers(req.body.peer);
        res.send();
    });

    app.post('/stop', (req, res) => {
        res.send({'msg' : 'stopping server'});
        process.exit();
    });

    app.listen(myHttpPort, () => {
        console.log('Listening http on port: ' + myHttpPort);
    });
};

initHttpServer(httpPort);
initP2PServer(p2pPort);