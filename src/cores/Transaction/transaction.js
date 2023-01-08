"use strict";

const BN = require("bn.js");
const { logger, isValidSHA256 } = require("../../utils/index");
const crypto = require("crypto"),
  SHA256 = (message) =>
    crypto.createHash("sha256").update(message).digest("hex");
const EC = require("elliptic").ec,
  ec = new EC("secp256k1");

class Transaction {
  constructor(fromAddress, toAddress, data = {}) {
    this.fromAddress = fromAddress;
    this.toAddress = toAddress;
    this.data = data;
    this.signature = {};
  }

  static getHash() {
    return SHA256(
      JSON.stringify(this.fromAddress + this.toAddress + this.data)
    );
  }

  static sign(tx, keyPair) {
    try {
      const sigObj = keyPair.sign(Transaction.getHash());
      tx.signature = {
        v: sigObj.recoveryParam.toString(16),
        r: sigObj.r.toString(16),
        s: sigObj.s.toString(16),
      };
      logger.info("Transaction signed.");
    } catch (error) {
      logger.error(error);
    }
  }

  static getPubKey(tx) {
    try {
      // Get transaction's body's hash and recover original signature object
      const msgHash = Transaction.getHash();
      const { r, s, v } = tx.signature;
      const sigObj = {
        r: new BN(r, 16),
        s: new BN(s, 16),
        recoveryParam: parseInt(v, 16),
      };

      // Recover public key and get real address.
      const txSenderPubkey = ec.recoverPubKey(
        new BN(msgHash, 16).toString(10),
        sigObj,
        ec.getKeyRecoveryParam(msgHash, sigObj, ec.genKeyPair().getPublic())
      );

      return ec.keyFromPublic(txSenderPubkey).getPublic("hex");
    } catch (error) {
      logger.error(error);
    }
  }

  static isValid(tx) {
    try {
      const { fromAddress, data, signature } = tx;

      if (!signature.r && !signature.v && !signature.s) {
        logger.error(`Transaction rejected: Unsigned transaction`);
        return false;
      }

      const txSenderPubkey = Transaction.getPubKey(tx);

      // Check that the fromAddress corresponds to the address used to sign the transaction
      const txSenderAddress = SHA256(txSenderPubkey);

      if (txSenderAddress !== SHA256(fromAddress)) {
        logger.error(
          `Transaction rejected: Invalid fromAddress. Expected ${txSenderAddress}, got ${SHA256(
            fromAddress
          )}`
        );
        return false;
      }

      // Check that the data field is valid
      if (!Transaction.isValidData(data)) {
        logger.error(
          `Transaction rejected: Invalid data: ${JSON.stringify(data)}`
        );
        return false;
      }
      return true;
    } catch (error) {
      logger.error(error);
      return false;
    }
  }

  static isValidData(data) {
    try {
      const { partyID } = data;
      if (!data && !partyID) {
        return false;
      }
      if (!isValidSHA256(partyID)) {
        return false;
      }
      return true;
    } catch (error) {
      logger.error(error);
    }
  }
}

module.exports = Transaction;
