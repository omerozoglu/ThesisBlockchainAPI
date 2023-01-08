const assert = require("assert");
const { logger } = require("../../utils");
const Transaction = require("./Transaction");
const ec = new (require("elliptic").ec)("secp256k1");
const crypto = require("crypto"),
  SHA256 = (message) =>
    crypto.createHash("sha256").update(message).digest("hex");

const alice = ec.genKeyPair();
const bob = ec.genKeyPair();
let partyID = "This is a mock party id";
let ID = SHA256(partyID);

describe("Transaction", () => {
  it("should create a new transaction with the given fromAddress, toAddress, and data", () => {
    const tx = new Transaction(alice.getPublic("hex"), bob.getPublic("hex"), {
      partyID: ID,
    });
    assert.strictEqual(tx.fromAddress, alice.getPublic("hex"));
    assert.strictEqual(tx.toAddress, bob.getPublic("hex"));
    assert.deepStrictEqual(tx.data, { partyID: ID });
  });

  it("should sign a transaction with the given key pair", () => {
    const tx = new Transaction(alice.getPublic("hex"), bob.getPublic("hex"), {
      partyID: ID,
    });
    Transaction.sign(tx, alice);
    assert.strictEqual(typeof tx.signature.v, "string");
    assert.strictEqual(typeof tx.signature.r, "string");
    assert.strictEqual(typeof tx.signature.s, "string");
  });

  it("should recover the correct public key for a signed transaction", () => {
    const tx = new Transaction(alice.getPublic("hex"), bob.getPublic("hex"), {
      partyID: ID,
    });
    Transaction.sign(tx, alice);
    const pubKey = Transaction.getPubKey(tx);
    assert.strictEqual(pubKey, alice.getPublic("hex"));
  });

  it("should correctly validate a signed transaction", () => {
    const tx = new Transaction(alice.getPublic("hex"), bob.getPublic("hex"), {
      partyID: ID,
    });
    Transaction.sign(tx, alice);
    assert(Transaction.isValid(tx));
  });

  it("should reject an unsigned transaction", () => {
    const tx = new Transaction(alice.getPublic("hex"), bob.getPublic("hex"), {
      partyID: ID,
    });
    assert(!Transaction.isValid(tx));
  });

  it("should reject a transaction signed with the wrong key pair", () => {
    const tx = new Transaction(alice.getPublic("hex"), bob.getPublic("hex"), {
      partyID: ID,
    });
    Transaction.sign(tx, bob);
    assert(!Transaction.isValid(tx));
  });

  it("should reject a transaction with the invalid data", () => {
    const tx = new Transaction(alice.getPublic("hex"), bob.getPublic("hex"), {
      partyID: "12321312",
    });
    Transaction.sign(tx, alice);
    assert(!Transaction.isValid(tx));
  });
});
