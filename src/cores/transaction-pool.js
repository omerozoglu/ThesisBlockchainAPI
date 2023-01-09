const { logger } = require("../utils");
const crypto = require("crypto"),
  SHA256 = (message) =>
    crypto.createHash("sha256").update(message).digest("hex");
const Transaction = require("./Transaction/transaction");

async function addTransaction(transaction, chainInfo, stateDB) {
  if (!(await Transaction.isValid(transaction))) {
    logger.error("Failed to add one transaction to pool.");
    return;
  }
  const txPool = chainInfo.transactionPool;
  // Get public key and address from sender
  const txSenderPubkey = Transaction.getPubKey(transaction);
  const txSenderAddress = SHA256(txSenderPubkey);
  if (!(await stateDB.keys().all()).includes(txSenderAddress)) {
    logger.error("StateDB :: Failed to add one transaction to pool.");
    return;
  }
  txPool.push(transaction);
  logger.info(`Added one transaction to pool`);
}

async function clearDepreciatedTxns(chainInfo, stateDB) {
  const txPool = chainInfo.transactionPool;

  const newTxPool = [],
    skipped = {};

  for (const tx of txPool) {
    const txSenderPubkey = Transaction.getPubKey(tx);
    const txSenderAddress = SHA256(txSenderPubkey);

    if (skipped[txSenderAddress]) continue;

    // Weak-checking
    if (Transaction.isValid(tx)) {
      newTxPool.push(tx);
    }
  }

  return newTxPool;
}
module.exports = { addTransaction, clearDepreciatedTxns };
