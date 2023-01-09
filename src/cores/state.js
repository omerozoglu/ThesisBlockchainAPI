"use strict";
const crypto = require("crypto"),
  SHA256 = (message) =>
    crypto.createHash("sha256").update(message).digest("hex");
const Transaction = require("./Transaction/transaction");

async function changeState(newBlock, stateDB) {
  const existedAddresses = await stateDB.keys().all();

  for (const tx of newBlock.transactions) {
    // If the address doesn't already exist in the chain state, we will create a new empty one.
    if (!existedAddresses.includes(tx.data)) {
      await stateDB.put(tx.data, {
        balance: "0",
        body: "",
        nonce: 0,
        storage: {},
      });
    }

    // Get sender's public key and address
    const txSenderPubkey = Transaction.getPubKey(tx);
    const txSenderAddress = SHA256(txSenderPubkey);

    // If the address doesn't already exist in the chain state, we will create a new empty one.
    if (!existedAddresses.includes(txSenderAddress)) {
      await stateDB.put(txSenderAddress, {
        balance: "0",
        body: "",
        nonce: 0,
        storage: {},
      });
    }

    // Normal transfer
    const dataFromSender = await stateDB.get(txSenderAddress);
    const dataFromRecipient = await stateDB.get(tx.data);

    await stateDB.put(txSenderAddress, {
      balance: BigInt(dataFromSender.balance).toString(),
      body: dataFromSender.body,
      nonce: dataFromSender.nonce + 1, // Update nonce
      storage: dataFromSender.storage,
    });

    await stateDB.put(tx.data, {
      balance: BigInt(dataFromRecipient.balance).toString(),
      body: dataFromRecipient.body,
      nonce: dataFromRecipient.nonce,
      storage: dataFromRecipient.storage,
    });
  }
}

module.exports = changeState;
