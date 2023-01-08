const { logger } = require("../utils");
const Transaction = require("./Transaction/transaction");

class TransactionPool {
  constructor() {
    this.transactions = [];
  }

  addTransaction(transaction) {
    this.transactions.push(transaction);
    logger.info(`Added one transaction to pool`);
  }

  validTransactions() {
    return this.transactions.filter((transaction) =>
      Transaction.verifyTransaction(transaction)
    );
  }
}

module.exports = TransactionPool;
