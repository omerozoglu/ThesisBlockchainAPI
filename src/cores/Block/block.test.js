"use strict";

const crypto = require("crypto"),
  SHA256 = (message) =>
    crypto.createHash("sha256").update(message).digest("hex");
const EC = require("elliptic").ec,
  ec = new EC("secp256k1");
const Transaction = require("../Transaction/transaction");
const { buildMerkleTree } = require("../merkle");
const { logger } = require("../../utils");
