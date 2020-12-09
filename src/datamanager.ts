import sqlite from 'better-sqlite3';
import sha256 from 'sha256';
import {
  Block,
  Accounts,
  Account,
  SignedTransaction,
  SignedTransactions,
  Transaction,
  MinedBlock,
  AccountResponse,
} from './types';
import config from './config.json';

const db = sqlite('tixl.db', {});

const initDb = () => {
  db.exec(`CREATE TABLE IF NOT EXISTS blocks \
    ('height' int8 not null primary key, \
    'miner' varchar not null, \
    'timestamp' int8 not null, \
    'hash' varchar not null);`);
  db.exec(`CREATE TABLE IF NOT EXISTS transactions \
    ('hash' varchar not null primary key, \
    'from' varchar not null, \
    'to' varchar not null, \
    'amount' int8 not null, \
    'nonce' int8 not null, \
    'block' int8 not null, \
    'timestamp' int8 not null);`);
  db.exec("CREATE TABLE IF NOT EXISTS accounts \
    ('address' varchar not null primary key, \
    'balance' int8 not null, \
    'tranactionCount' int8 not null);");
};

initDb();

class DataManager {
  private genesis: string;
  private blockMineTime: number;
  private accounts: Accounts = {};
  private blocks: MinedBlock[] = [];
  private currentBlock: Block;
  private transactions: SignedTransactions = {};
  private miners: string[];
  private mineFee: number;
  private timer: any;

  constructor() {
    this.genesis = config.genesis;
    this.blockMineTime = config.blockMineTime;
    this.miners = config.miners;
    this.mineFee = config.mineFee;

    this.init();
  }

  private init() {
    this.transactions = {};
    this.blocks = [];
    this.accounts = {};

    this.loadFromDB();
    if (this.accounts[this.genesis] === undefined) {
      this.accounts[this.genesis] = {
        address: this.genesis,
        tranactionCount: 0,
        balance: 0,
      }
    }

    this.timer = setInterval(() => {
      this.mineBlock()
    }, this.blockMineTime);
  }

  public restart() {
    if (this.timer) {
      clearInterval(this.timer);
    }
    console.log('===Restart===');
    db.exec(`DELETE FROM transactions;`);
    db.exec(`DELETE FROM blocks;`);
    db.exec(`DELETE FROM accounts;`);

    this.init();
  }

  private loadFromDB() {
    const accounts = db.prepare('SELECT * FROM accounts').all();
    for (const account of accounts) {
      this.accounts[account.address] = account;
    }

    const transactions = db.prepare('SELECT * FROM transactions').all();
    for (const tx of transactions) {
      this.transactions[tx.hash] = tx;
    }

    const blocks = db.prepare('SELECT * FROM blocks order by height').all();
    for (const block of blocks) {
      const minedBlock = {
        ...block,
        transactions: transactions.filter((tx: SignedTransaction) => {
          return tx.block === block.height;
        }).map((tx: SignedTransaction) => {
          return tx.hash;
        })
      }
      this.blocks.push(minedBlock);
    }

    this.currentBlock = {
      transactions: [],
      timestamp: Math.floor(Date.now() / 1000),
    };
    console.log('Loaded from DB');
  }

  public send(from: string, to: string, amount: number): string {
    if (this.accounts[from]) {
      const fromAccount: Account = this.accounts[from];
      let toAccount: Account = this.accounts[to];
      if (toAccount === undefined) {
        toAccount = {
          address: to,
          balance: 0,
          tranactionCount: 0,
        }
      }
      if (from === this.genesis || fromAccount.balance >= amount) {
        const newTx: Transaction = {
          from,
          to,
          amount,
          nonce: fromAccount.tranactionCount,
          timestamp: Math.floor(Date.now() / 1000),
        }
        fromAccount.tranactionCount += 1;
        if (from !== this.genesis) {
          fromAccount.balance -= amount;
        }
        toAccount.balance += amount;

        this.accounts[from] = fromAccount;
        this.accounts[to] = toAccount;

        const hash = sha256(JSON.stringify(newTx));
        const signedTx: SignedTransaction = {
          hash,
          block: this.blockHeight,
          ...newTx,
        };
        this.transactions[hash] = signedTx;
        this.currentBlock.transactions.push(hash);
        console.log('Tx sent successfully with hash: ' + hash);
        return hash;
      } else {
        console.error('insufficiant balance');
        throw new Error('insufficiant balance');
      }
    } else {
      console.error('insufficiant balance');
      throw new Error('insufficiant balance');
    }
  }

  public getBlock(height: number): Block {
    if (height < this.blockHeight) {
      return this.blocks[height];
    }
    throw new Error('Block does not exist with height ' + height);
  }

  public getTransaction(hash: string): SignedTransaction {
    if (this.transactions[hash]) {
      return this.transactions[hash];
    }
    throw new Error('Transaction does not exist with hash ' + hash);
  }

  public get blockHeight(): number {
    return this.blocks.length;
  }

  public getAccount(address: string): AccountResponse {
    if (!this.accounts[address]) {
      return {
        address,
        balance: 0,
        tranactionCount: 0,
        transactions: [],
      }
    }
    const txs: string[] = [];
    for (const hash of Object.keys(this.transactions)) {
      const transaction = this.transactions[hash];
      if (transaction.from === address || transaction.to === address) {
        txs.push(hash);
      }
    }

    if (address === this.genesis) {
      return {
        ...this.accounts[address],
        balance: Number.MAX_VALUE,
        transactions: txs,
      }
    }
    return {
      ...this.accounts[address],
      transactions: txs,
    }
  }

  private mineBlock() {
    const miner = this.miners[Math.floor(Math.random() * this.miners.length) % this.miners.length];
    this.send(this.genesis, miner, this.mineFee);

    const minedBlock: MinedBlock = {
      ...this.currentBlock,
      height: this.blockHeight,
      miner,
    }
    minedBlock.hash = sha256(JSON.stringify(minedBlock));

    this.currentBlock = {
      transactions: [],
      timestamp: Math.floor(Date.now() / 1000),
    };
    console.log(`Block ${minedBlock.height} mint by ${miner}`);
    this.saveToDB(minedBlock);
    this.blocks.push(minedBlock);
  }

  private saveToDB(block: MinedBlock) {
    db.exec(`INSERT INTO blocks ('height', 'miner', 'timestamp', 'hash') \
      VALUES(${block.height}, '${block.miner}', ${block.timestamp}, '${block.hash}');`);
    for (const hash of block.transactions) {
      const transaction = this.transactions[hash];
      if (transaction === undefined) {
        throw new Error('Invalid transaction');
      }
      db.exec(`INSERT INTO transactions ('hash', 'from', 'to', 'amount', 'nonce', 'block', 'timestamp') \
        VALUES('${transaction.hash}', '${transaction.from}', '${transaction.to}', ${transaction.amount}, ${transaction.nonce}, ${transaction.block}, ${transaction.timestamp});`);
    }

    for (const address of Object.keys(this.accounts)) {
      const account = this.accounts[address];

      db.exec(`INSERT INTO accounts ('address', 'balance', 'tranactionCount') \
        VALUES('${account.address}', ${account.balance}, ${account.tranactionCount}) \
        ON CONFLICT(address) DO UPDATE SET balance=${account.balance}, tranactionCount=${account.tranactionCount};`);
    }
  }
};

export const dataManager = new DataManager();
