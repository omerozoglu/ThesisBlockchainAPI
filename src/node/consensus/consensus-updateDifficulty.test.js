const assert = require("assert");
const { updateDifficulty } = require("../consensus/consensus");

describe("updateDifficulty", function () {
  it("should update the difficulty of the block if necessary", async function () {
    const newBlock = {
      blockNumber: 100,
      timestamp: Date.now(),
      difficulty: 1,
      prevHash: "valid hash",
      nonce: 1,
      hash: "valid hash",
      transactions: [],
    };
    const oldBlock = {
      blockNumber: 1,
      timestamp: Date.now() - 10000,
      difficulty: 1,
      prevHash: "valid hash",
      nonce: 1,
      hash: "valid hash",
      transactions: [],
    };

    const blockDB = {
      async get(blockNumber) {
        return oldBlock;
      },
    };

    await updateDifficulty(newBlock, blockDB);
    assert.notStrictEqual(newBlock.difficulty, 1);
  });

  it("should not update the difficulty of the block if it is not necessary", async function () {
    const newBlock = {
      blockNumber: 99,
      timestamp: Date.now(),
      difficulty: 1,
      prevHash: "valid hash",
      nonce: 1,
      hash: "valid hash",
      transactions: [],
    };
    const oldBlock = {
      blockNumber: 1,
      timestamp: Date.now() - 10000,
      difficulty: 1,
      prevHash: "valid hash",
      nonce: 1,
      hash: "valid hash",
      transactions: [],
    };

    const blockDB = {
      async get(blockNumber) {
        return oldBlock;
      },
    };

    await updateDifficulty(newBlock, blockDB);
    assert.strictEqual(newBlock.difficulty, 1);
  });
});
