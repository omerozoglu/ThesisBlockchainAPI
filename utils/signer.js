const Transaction = require("../src/cores/Transaction/transaction");
const { logger } = require("../src/utils");
const crypto = require("crypto"),
  SHA256 = (message) =>
    crypto.createHash("sha256").update(message).digest("hex");
const EC = require("elliptic").ec,
  ec = new EC("secp256k1");

const keyPair = ec.genKeyPair();
const publicKey = SHA256(keyPair.getPublic("hex"));

const tx = new Transaction(publicKey, "Valid toAddress", {
  partyID: "eb1e33e8a81b697b75855af6bfcdbcbf7cbbde9f94962ceaec1ed8af21f5a50f",
});

const sigObj = keyPair.sign(Transaction.getHash(tx));
tx.signature = {
  v: sigObj.recoveryParam.toString(16),
  r: sigObj.r.toString(16),
  s: sigObj.s.toString(16),
};

logger.info(JSON.stringify(tx));
logger.info("Transaction signed.");
