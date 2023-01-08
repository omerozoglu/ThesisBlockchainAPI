const crypto = require("crypto"),
  SHA256 = (message) =>
    crypto.createHash("sha256").update(message).digest("hex");

const { Block } = require("../../cores/index");
const { BLOCK_TIME } = require("../../config.json");
const { logger } = require("../../utils");

async function verifyBlock(newBlock, chainInfo) {
  try {
    if (!Block.hasValidPropTypes(newBlock)) {
      return false;
    }
    if (!Block.hasValidTransactions(newBlock)) {
      return false;
    }
    //Check hash
    const prevBlockHash = chainInfo.latestBlock.hash;
    if (prevBlockHash !== newBlock.prevHash) {
      return false;
    }
    if (
      !SHA256(
        newBlock.blockNumber.toString() +
          newBlock.timestamp.toString() +
          newBlock.difficulty.toString() +
          newBlock.prevHash +
          newBlock.nonce.toString()
      ) === newBlock.hash
    ) {
      return false;
    }
    // Check proof of work
    if (!newBlock.hash.startsWith(Array(chainInfo.difficulty + 1).join("0"))) {
      return false;
    }
    if (newBlock.difficulty !== chainInfo.difficulty) {
      return false;
    }
    // Check timestamp
    if (
      !(newBlock.timestamp > chainInfo.latestBlock.timestamp) &&
      !(newBlock.timestamp < Date.now())
    ) {
      return false;
    }
    // Check block number
    if (newBlock.blockNumber - 1 !== chainInfo.latestBlock.blockNumber) {
      return false;
    }

    return true;
  } catch (error) {
    logger.error(error);
  }
}

async function updateDifficulty(newBlock, blockDB) {
  if (newBlock.blockNumber % 100 === 0) {
    const oldBlock = await blockDB.get((newBlock.blockNumber - 99).toString());

    newBlock.difficulty = Math.ceil(
      (newBlock.difficulty * 100 * BLOCK_TIME) /
        (newBlock.timestamp - oldBlock.timestamp)
    );
  }
}

module.exports = { verifyBlock, updateDifficulty };
