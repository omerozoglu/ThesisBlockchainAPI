const assert = require("assert");
const { verifyBlock } = require("./consensus");

describe("verifyBlock", function () {
  it("should return false if the block does not meet the proof of work requirement", async function () {
    const newBlock = {
      blockNumber: 2,
      timestamp: Date.now(),
      difficulty: 1,
      prevHash: "valid hash",
      nonce: 1,
      hash: "invalid hash",
      transactions: [],
    };
    const chainInfo = {
      latestBlock: {
        blockNumber: 1,
        timestamp: Date.now(),
        difficulty: 1,
        prevHash: "valid hash",
        nonce: 1,
        hash: "valid hash",
        transactions: [],
      },
      difficulty: 2,
    };

    assert.strictEqual(await verifyBlock(newBlock, chainInfo), false);
  });

  it("should return false if the block has the wrong difficulty level", async function () {
    const newBlock = {
      blockNumber: 2,
      timestamp: Date.now(),
      difficulty: 2,
      prevHash: "valid hash",
      nonce: 1,
      hash: "valid hash",
      transactions: [],
    };
    const chainInfo = {
      latestBlock: {
        blockNumber: 1,
        timestamp: Date.now(),
        difficulty: 1,
        prevHash: "valid hash",
        nonce: 1,
        hash: "valid hash",
        transactions: [],
      },
      difficulty: 1,
    };

    assert.strictEqual(await verifyBlock(newBlock, chainInfo), false);
  });

  it("should return false if the block has the wrong timestamp", async function () {
    const newBlock = {
      blockNumber: 2,
      timestamp: Date.now() - 10000,
      difficulty: 1,
      prevHash: "valid hash",
      nonce: 1,
      hash: "valid hash",
      transactions: [],
    };
    const chainInfo = {
      latestBlock: {
        blockNumber: 1,
        timestamp: Date.now(),
        difficulty: 1,
        prevHash: "valid hash",
        nonce: 1,
        hash: "valid hash",
        transactions: [],
      },
      difficulty: 1,
    };

    assert.strictEqual(await verifyBlock(newBlock, chainInfo), false);
  });

  it("should return false if the block has the wrong block number", async function () {
    const newBlock = {
      blockNumber: 3,
      timestamp: Date.now(),
      difficulty: 1,
      prevHash: "valid hash",
      nonce: 1,
      hash: "valid hash",
      transactions: [],
    };
    const chainInfo = {
      latestBlock: {
        blockNumber: 1,
        timestamp: Date.now(),
        difficulty: 1,
        prevHash: "valid hash",
        nonce: 1,
        hash: "valid hash",
        transactions: [],
      },
      difficulty: 1,
    };

    assert.strictEqual(await verifyBlock(newBlock, chainInfo), false);
  });

  it("should return false if the block has the wrong hash", async function () {
    const newBlock = {
      blockNumber: 2,
      timestamp: Date.now(),
      difficulty: 1,
      prevHash: "valid hash",
      nonce: 1,
      hash: "invalid hash",
      transactions: [],
    };
    const chainInfo = {
      latestBlock: {
        blockNumber: 1,
        timestamp: Date.now(),
        difficulty: 1,
        prevHash: "valid hash",
        nonce: 1,
        hash: "valid hash",
        transactions: [],
      },
      difficulty: 1,
    };

    assert.strictEqual(await verifyBlock(newBlock, chainInfo), false);
  });
});
