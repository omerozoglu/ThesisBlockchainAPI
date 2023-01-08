const { Block } = require("../../cores/index");
const assert = require("assert");

describe("Miner thread", () => {
  it("should mine the block with the correct difficulty", () => {
    // Arrange
    const block = new Block("test data", "0");
    const difficulty = 3;

    // Act
    const minedBlock = mine(block, difficulty);

    // Assert
    assert(minedBlock.hash.startsWith(Array(difficulty + 1).join("0")));
  });
});

function mine(block, difficulty) {
  while (!block.hash.startsWith(Array(difficulty + 1).join("0"))) {
    block.nonce++;
    block.hash = Block.getHash(block);
  }
  return block;
}
