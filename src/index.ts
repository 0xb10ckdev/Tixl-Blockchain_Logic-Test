import express from "express";
import bodyParser from "body-parser";
import config from './config.json';
import { dataManager } from './datamanager';

const app = express();
const port = 4000;
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(bodyParser.raw());

app.get("/address/:address", (req, res) => {
  const address = req.params.address;
  if (address) {
    res.send(dataManager.getAccount(address));
    return;
  }
  throw new Error('Invalid address');
});

app.get("/transaction/:hash", (req, res) => {
  const hash = req.params.hash;
  if (hash) {
    res.send(dataManager.getTransaction(hash));
    return;
  }
  throw new Error('Invalid hash');
});

app.get("/block/:height", (req, res) => {
  const height = req.params.height;
  if (height) {
    res.send(dataManager.getBlock(Number(height)));
    return;
  }
  throw new Error('Invalid block height');
});

app.post("/transaction", (req, res) => {
  const body = req.body;
  if (body.from === undefined) {
    throw new Error('Invalid sender');
  }
  if (body.to === undefined) {
    throw new Error('Invalid receiver');
  }
  if (body.amount === undefined) {// || Number(body.amount) === NaN) {
    throw new Error('Invalid amount');
  }
  const txHash = send(body.from, body.to, body.amount);

  res.send({
    hash: txHash,
    success: true
  });
})

app.post("/restart", (req, res) => {
  dataManager.restart();

  res.send({
    success: true
  });
})
// start the Express server
app.listen(port, () => {
  console.log( `server started at http://localhost:${ port }` );
});

const send = (from: string, to: string, amount: number): string => {
  return dataManager.send(from, to, amount);
};
