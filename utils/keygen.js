const { logger } = require("../src/utils");

const crypto = require("crypto"),
  SHA256 = (message) =>
    crypto.createHash("sha256").update(message).digest("hex");

const EC = require("elliptic").ec,
  ec = new EC("secp256k1");

const keyPair = ec.genKeyPair();

const pubKey = keyPair.getPublic("hex");
const privKey = keyPair.getPrivate("hex");
const address = SHA256(pubKey);

logger.info("Address :: " + address);
logger.info("Public key :: " + pubKey);
logger.info("Private key :: " + privKey);
