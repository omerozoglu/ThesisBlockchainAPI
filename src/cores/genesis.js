const EC = require("elliptic").ec,
  ec = new EC("secp256k1");
const { PRIVATE_KEY } = require("../../config.json");
const { logger } = require("../utils");

const Block = require("./Block/block");
const Transaction = require("./Transaction/transaction");

const MINT_KEY_PAIR = ec.keyFromPrivate(PRIVATE_KEY, "hex");
const MINT_PUBLIC_ADDRESS = MINT_KEY_PAIR.getPublic("hex");
function generateGenesisBlock() {
  try {
    const firstMint = new Transaction(MINT_PUBLIC_ADDRESS, "", {});
    Transaction.sign(firstMint, MINT_KEY_PAIR);
    logger.info(`Genesis block created`);
    return new Block(1, Date.now(), [firstMint], 1, "");
  } catch (error) {
    logger.error(error);
  }
}
module.exports = generateGenesisBlock;
