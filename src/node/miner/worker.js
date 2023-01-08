"use strict";

// Miner thread's code.

const { Block } = require("../../cores/index");

// Listening for messages from the main process.
process.on("message", (message) => {
  if (message.type === "MINE") {
    // When the "MINE" message is received, the thread should be mining by incrementing the nonce value until a preferable hash is met.

    const block = message.data[0];
    const difficulty = message.data[1];

    for (;;) {
      if (block.hash.startsWith(Array(difficulty + 1).join("0"))) {
        process.send({ result: block });

        break;
      }
      block.nonce++;
      block.hash = Block.getHash(block);
    }
  }
});
