"use strict";

const crypto = require("crypto"),
  SHA256 = (message) =>
    crypto.createHash("sha256").update(message).digest("hex");
const EC = require("elliptic").ec,
  ec = new EC("secp256k1");
const { logger } = require("../../utils");
const Transaction = require("../Transaction/transaction");

class Block {
  constructor(
    blockNumber = 1,
    timestamp = Date.now(),
    transactions = [],
    difficulty = 1,
    prevHash = ""
  ) {
    this.transactions = transactions;
    this.blockNumber = blockNumber;
    this.timestamp = timestamp;
    this.difficulty = difficulty;
    this.prevHash = prevHash;
    this.nonce = 0;
    this.hash = Block.getHash(this);
  }

  static getHash(block) {
    return SHA256(
      block.blockNumber.toString() +
        block.timestamp.toString() +
        block.difficulty.toString() +
        block.prevHash +
        block.nonce.toString()
    );
  }

  static hasValidPropTypes(block) {
    return (
      Array.isArray(block.transactions) &&
      typeof block.blockNumber === "number" &&
      typeof block.timestamp === "number" &&
      typeof block.difficulty === "number" &&
      typeof block.prevHash === "string" &&
      typeof block.nonce === "number" &&
      typeof block.hash === "string"
    );
  }

  static hasValidTransactions(block) {
    try {
      for (let i = 0; i < block.transactions.length; i++) {
        const tx = block.transactions[i];
        if (!Transaction.isValid(tx)) {
          return false;
        }
      }
      return true;
    } catch (error) {
      logger.error(error);
      return false;
    }
  }

  static isValid(block) {
    try {
      if (!Block.hasValidPropTypes(block)) {
        logger.error(`Block rejected: Invalid property types`);
        return false;
      }
      if (!Block.hasValidTransactions(block)) {
        logger.error(`Block rejected: Invalid transactions`);
        return false;
      }

      return true;
    } catch (error) {
      logger.error(error);
      return false;
    }
  }
}

// const alice = ec.genKeyPair();
// const bob = ec.genKeyPair();
// let partyID = "This is a mock party id";
// let ID = SHA256(partyID);
// const txSigned = new Transaction(alice.getPublic("hex"), bob.getPublic("hex"), {
//   partyID: ID,
// });
// Transaction.sign(txSigned, alice);

// const alice2 = ec.genKeyPair();
// const bob2 = ec.genKeyPair();
// let partyID2 = "This is a mock party id";
// let ID2 = SHA256(partyID2);
// const tx = new Transaction(alice2.getPublic("hex"), bob2.getPublic("hex"), {
//   partyID: ID2,
// });
// Transaction.sign(tx, alice2);
// const txs = [txSigned, tx];

// const block = new Block(1, Date.now(), txs, 1, "0");
// logger.info(Block.isValid(block));
module.exports = Block;
