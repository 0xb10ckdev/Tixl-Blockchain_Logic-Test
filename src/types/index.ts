export interface TransactionRequest {
  from: string;
  to: string;
  amount: number;
};

export interface Transaction {
  from: string;
  to: string;
  amount: number;
  nonce: number;
  timestamp: number;
};

export interface SignedTransaction {
  hash: string;
  from: string;
  to: string;
  amount: number;
  nonce: number;
  block: number;
  timestamp: number;
};

export interface SignedTransactions {
  [key: string]: SignedTransaction;
};

export interface Account {
  address: string;
  balance: number;
  tranactionCount: number;
};

export interface AccountResponse {
  address: string;
  balance: number;
  tranactionCount: number;
  transactions: string[];
};

export interface Accounts {
  [key: string]: Account;
};

export interface Block {
  transactions: string[];
  timestamp: number;
};

export interface MinedBlock {
  transactions: string[];
  hash?: string;
  miner: string;
  height: number;
  timestamp: number;
};
