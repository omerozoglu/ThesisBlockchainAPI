"use strict";

const crypto = require("crypto"),
  SHA256 = (message) =>
    crypto.createHash("sha256").update(message).digest("hex");
const WS = require("ws");
const EC = require("elliptic").ec,
  ec = new EC("secp256k1");
const { Level } = require("level");
const { fork } = require("child_process");

const {
  Block,
  Transaction,
  generateGenesisBlock,
  changeState,
} = require("../cores/index");
const { produceMessage, sendMessage } = require("./messages/message");
const TYPE = require("./messages/message-types");
const {
  addTransaction,
  clearDepreciatedTxns,
} = require("../cores/transaction-pool");
const rpc = require("../rpc/rpc");
const { verifyBlock, updateDifficulty } = require("./consensus/consensus");
const { logger, parseJSON } = require("../utils");

const opened = []; // Addresses and sockets from connected nodes.
const connected = []; // Addresses from connected nodes.
let connectedNodes = 0;

let worker = fork(`${__dirname}/./miner/worker.js`); // Worker thread (for PoW mining).
let mined = false; // This will be used to inform the node that another node has already mined before it.

// Some chain info cache
const chainInfo = {
  transactionPool: [],
  latestBlock: generateGenesisBlock(),
  latestSyncBlock: null,
  checkedBlock: {},
  tempStates: {},
  difficulty: 1,
};

const stateDB = new Level(__dirname + "/../../log/stateStore", {
  valueEncoding: "json",
});
const blockDB = new Level(__dirname + "/../../log/blockStore", {
  valueEncoding: "json",
});

async function startServer(options) {
  const PORT = options.PORT || 3000; // Node's PORT
  const RPC_PORT = options.RPC_PORT || 5000; // RPC server's PORT
  const PEERS = options.PEERS || []; // Peers to connect to
  const MAX_PEERS = options.MAX_PEERS || 10; // Maximum number of peers to connect to
  const MY_ADDRESS = options.MY_ADDRESS || "ws://localhost:3000"; // Node's address
  const ENABLE_MINING = options.ENABLE_MINING ? true : false; // Enable mining?
  const ENABLE_LOGGING = options.ENABLE_LOGGING ? true : false; // Enable logging?
  const ENABLE_RPC = options.ENABLE_RPC ? true : false; // Enable RPC server?
  let ENABLE_CHAIN_REQUEST = options.ENABLE_CHAIN_REQUEST ? true : false; // Enable chain sync request?

  const privateKey = options.PRIVATE_KEY || ec.genKeyPair().getPrivate("hex");
  const keyPair = ec.keyFromPrivate(privateKey, "hex");
  const publicKey = keyPair.getPublic("hex");

  process.on("uncaughtException", (err) => logger.error(err));

  const server = new WS.Server({ port: PORT });

  logger.info(`Listening on PORT :: ${PORT.toString()}`);

  server.on("connection", async (socket, req) => {
    // Message handler
    socket.on("message", async (message) => {
      const _message = parseJSON(message); // Parse binary message to JSON

      switch (_message.type) {
        // Below are handlers for every message types.

        case TYPE.NEW_BLOCK:
          // "TYPE.NEW_BLOCK" is sent when someone wants to submit a new block.
          // Its message body must contain the new block and the new difficulty.

          const newBlock = _message.data;

          // We will only continue checking the block if its parentHash is not the same as the latest block's hash.
          // This is because the block sent to us is likely duplicated or from a node that has lost and should be discarded.

          if (!chainInfo.checkedBlock[newBlock.hash]) {
            chainInfo.checkedBlock[newBlock.hash] = true;
          } else {
            return;
          }

          if (
            newBlock.prevHash !== chainInfo.latestBlock.prevHash &&
            (!ENABLE_CHAIN_REQUEST ||
              (ENABLE_CHAIN_REQUEST && currentSyncBlock > 1))
            // Only proceed if syncing is disabled or enabled but already synced at least the genesis block
          ) {
            chainInfo.checkedBlock[newBlock.hash] = true;

            if (await verifyBlock(newBlock, chainInfo)) {
              logger.info("New block received.");

              // If mining is enabled, we will set mined to true, informing that another node has mined before us.
              if (ENABLE_MINING) {
                mined = true;

                worker.kill(); // Stop the worker thread

                worker = fork(`${__dirname}/./miner/worker.js`); // Renew
              }

              await updateDifficulty(newBlock, chainInfo, blockDB); // Update difficulty

              await blockDB.put(newBlock.blockNumber.toString(), newBlock); // Add block to chain

              chainInfo.latestBlock = newBlock; // Update chain info
              // Update the new transaction pool (remove all the transactions that are no longer valid).
              chainInfo.transactionPool = await clearDepreciatedTxns(
                chainInfo,
                stateDB
              );
              
              logger.info(
                `Block #${newBlock.blockNumber} synced, state transited.`
              );

              sendMessage(message, opened); // Broadcast block to other nodes

              if (ENABLE_CHAIN_REQUEST) {
                ENABLE_CHAIN_REQUEST = false;
              }
            }
          }

          break;

        case TYPE.CREATE_TRANSACTION:
          if (ENABLE_CHAIN_REQUEST) break; // Unsynced nodes should not be able to proceed.

          const transaction = _message.data;

          if (!(await Transaction.isValid(transaction))) break;

          const txSenderPubkey = Transaction.getPubKey(transaction);
          const txSenderAddress = SHA256(txSenderPubkey);

          if (!(await stateDB.keys().all()).includes(txSenderAddress)) {
            break;
          }

          logger.info(
            "LOG :: New transaction received, broadcasted and added to pool."
          );

          if (chainInfo.transactionPool.includes(transaction)) {
            return;
          }

          chainInfo.transactionPool.push(transaction);
          const others = opened.filter(
            (node) => node.address !== requestAddress
          );
          // Broadcast the transaction
          sendMessage(message, others);

          break;

        case TYPE.REQUEST_BLOCK:
          if (!ENABLE_CHAIN_REQUEST) {
            // Unsynced nodes should not be able to send blocks
            const { blockNumber, requestAddress } = _message.data;

            const socket = opened.find(
              (node) => node.address === requestAddress
            ).socket; // Get socket from address

            const currentBlockNumber = Math.max(
              ...(await blockDB.keys().all()).map((key) => parseInt(key))
            ); // Get latest block number

            if (blockNumber > 0 && blockNumber <= currentBlockNumber) {
              // Check if block number is valid
              const block = await blockDB.get(blockNumber.toString()); // Get block

              socket.send(produceMessage(TYPE.SEND_BLOCK, block)); // Send block

              logger.info(
                `LOG :: Sent block at position ${blockNumber} to ${requestAddress}.`
              );
            }
          }

          break;

        case TYPE.SEND_BLOCK:
          const block = _message.data;

          if (ENABLE_CHAIN_REQUEST && currentSyncBlock === block.blockNumber) {
            if (
              chainInfo.latestSyncBlock === null || // If latest synced block is null then we immediately add the block into the chain without verification. // This happens due to the fact that the genesis block can discard every possible set rule ¯\_(ツ)_/¯
              (await verifyBlock(block, chainInfo))
            ) {
              currentSyncBlock += 1;

              await blockDB.put(block.blockNumber.toString(), block); // Add block to chain.

              if (!chainInfo.latestSyncBlock) {
                chainInfo.latestSyncBlock = block; // Update latest synced block.
                await changeState(block, stateDB, ENABLE_LOGGING); // Transit state
              }
              chainInfo.latestBlock = block; // Update latest block.

              await updateDifficulty(block, chainInfo, blockDB); // Update difficulty.

              logger.info(
                `LOG :: Synced block at position ${block.blockNumber}.`
              );

              // Continue requesting the next block
              for (const node of opened) {
                node.socket.send(
                  produceMessage(TYPE.REQUEST_BLOCK, {
                    blockNumber: currentSyncBlock,
                    requestAddress: MY_ADDRESS,
                  })
                );

                await new Promise((r) => setTimeout(r, 5000)); // Delay for block verification
              }
            }
          }

          break;

        case TYPE.HANDSHAKE:
          const address = _message.data;

          if (connectedNodes <= MAX_PEERS) {
            connect(MY_ADDRESS, address);
          }
      }
    });
  });

  if (!ENABLE_CHAIN_REQUEST) {
    if ((await blockDB.keys().all()).length === 0) {
      await blockDB.put(
        chainInfo.latestBlock.blockNumber.toString(),
        chainInfo.latestBlock
      );
      await changeState(chainInfo.latestBlock, stateDB);
    } else {
      chainInfo.latestBlock = await blockDB.get(
        Math.max(
          ...(await blockDB.keys().all()).map((key) => parseInt(key))
        ).toString()
      );
      chainInfo.difficulty = chainInfo.latestBlock.difficulty;
    }
  }

  PEERS.forEach((peer) => connect(MY_ADDRESS, peer)); // Connect to peerss

  // Sync chain
  let currentSyncBlock = 1;

  if (ENABLE_CHAIN_REQUEST) {
    const blockNumbers = await blockDB.keys().all();

    if (blockNumbers.length !== 0) {
      currentSyncBlock = Math.max(...blockNumbers.map((key) => parseInt(key)));
    }

    setTimeout(async () => {
      for (const node of opened) {
        node.socket.send(
          produceMessage(TYPE.REQUEST_BLOCK, {
            blockNumber: currentSyncBlock,
            requestAddress: MY_ADDRESS,
          })
        );

        await new Promise((r) => setTimeout(r, 5000)); // Delay for block verification
      }
    }, 5000);
  }

  if (ENABLE_MINING) loopMine(publicKey, ENABLE_CHAIN_REQUEST, ENABLE_LOGGING);
  if (ENABLE_RPC)
    rpc(
      RPC_PORT,
      { publicKey, mining: ENABLE_MINING, MY_ADDRESS },
      sendTransaction,
      keyPair,
      stateDB,
      blockDB
    );
}
// Function to connect to a node.
function connect(MY_ADDRESS, address) {
  if (
    !connected.find((peerAddress) => peerAddress === address) &&
    address !== MY_ADDRESS
  ) {
    const socket = new WS(address); // Get address's socket.

    // Open a connection to the socket.
    socket.on("open", async () => {
      for (const _address of [MY_ADDRESS, ...connected])
        socket.send(produceMessage(TYPE.HANDSHAKE, _address));
      for (const node of opened)
        node.socket.send(produceMessage(TYPE.HANDSHAKE, address));

      // If the address already existed in "connected" or "opened", we will not push, preventing duplications.
      if (
        !opened.find((peer) => peer.address === address) &&
        address !== MY_ADDRESS
      ) {
        opened.push({ socket, address });
      }

      if (
        !connected.find((peerAddress) => peerAddress === address) &&
        address !== MY_ADDRESS
      ) {
        connected.push(address);

        connectedNodes++;

        logger.info(`LOG :: Connected to ${address}.`);

        // Listen for disconnection, will remove them from "opened" and "connected".
        socket.on("close", () => {
          opened.splice(connected.indexOf(address), 1);
          connected.splice(connected.indexOf(address), 1);

          logger.info(`LOG :: Disconnected from ${address}.`);
        });
      }
    });
  }

  return true;
}

// Function to broadcast a transaction.
async function sendTransaction(transaction, MY_ADDRESS) {
  sendMessage(
    produceMessage(TYPE.CREATE_TRANSACTION, {
      transaction: transaction,
      requestAddress: MY_ADDRESS,
    }),
    opened
  );

  logger.info("LOG :: Sent one transaction.");

  await addTransaction(transaction, chainInfo, stateDB);
}

async function mine(publicKey, ENABLE_LOGGING) {
  function mine(block, difficulty) {
    return new Promise((resolve, reject) => {
      worker.addListener("message", (message) => resolve(message.result));

      worker.send({ type: "MINE", data: [block, difficulty] }); // Send a message to the worker thread, asking it to mine.
    });
  }

  // Create a new block.
  const block = new Block(
    chainInfo.latestBlock.blockNumber + 1,
    Date.now(),
    [], // Will add transactions down here
    chainInfo.difficulty,
    chainInfo.latestBlock.hash
  );

  // Collect a list of transactions to mine
  const transactionsToMine = [],
    states = {},
    skipped = {};

  const existedAddresses = await stateDB.keys().all();
  for (const tx of chainInfo.transactionPool) {
    const txSenderPubkey = Transaction.getPubKey(tx);
    const txSenderAddress = SHA256(txSenderPubkey);

    if (skipped[txSenderAddress]) continue; // Check if transaction is from an ignored address.

    // Normal coin transfers
    // if (!states[txSenderAddress]) {
    //   const senderState = await stateDB.get(txSenderAddress);

    //   states[txSenderAddress] = senderState;

    //   if (senderState.body !== "") {
    //     skipped[txSenderAddress] = true;
    //     continue;
    //   }

    //   states[txSenderAddress].balance = (
    //     BigInt(senderState.balance) -
    //     BigInt(tx.amount) -
    //     BigInt(tx.gas) -
    //     BigInt(tx.additionalData.contractGas || 0)
    //   ).toString();
    // } else {
    //   if (states[txSenderAddress].body !== "") {
    //     skipped[txSenderAddress] = true;
    //     continue;
    //   }

    //   states[txSenderAddress].balance = (
    //     BigInt(states[txSenderAddress].balance) -
    //     BigInt(tx.amount) -
    //     BigInt(tx.gas) -
    //     BigInt(tx.additionalData.contractGas || 0)
    //   ).toString();
    // }

    // if (!existedAddresses.includes(tx.recipient) && !states[tx.recipient]) {
    //   states[tx.recipient] = { balance: "0", body: "", nonce: 0, storage: {} };
    // }

    // if (existedAddresses.includes(tx.recipient) && !states[tx.recipient]) {
    //   states[tx.recipient] = await stateDB.get(tx.recipient);
    // }

    // states[tx.recipient].balance = (
    //   BigInt(states[tx.recipient].balance) + BigInt(tx.amount)
    // ).toString();

    // Update nonce
    //states[txSenderAddress].nonce += 1;

    // Decide to drop or add transaction to block
    // if (BigInt(states[txSenderAddress].balance) < 0n) {
    //   skipped[txSenderAddress] = true;
    //   continue;
    // } else {
    transactionsToMine.push(tx);
    // }
  }
  block.transactions = transactionsToMine;
  // Mine the block.
  mine(block, chainInfo.difficulty)
    .then(async (result) => {
      // If the block is not mined before, we will add it to our chain and broadcast this new block.
      if (!mined) {
        await updateDifficulty(result, chainInfo, blockDB); // Update difficulty

        await blockDB.put(result.blockNumber.toString(), result); // Add block to chain

        chainInfo.latestBlock = result; // Update chain info

        // Transit state
        for (const account of Object.keys(states)) {
          await stateDB.put(account, states[account]);
        }

        // // Update the new transaction pool (remove all the transactions that are no longer valid).
        // chainInfo.transactionPool = await clearDepreciatedTxns(
        //   chainInfo,
        //   stateDB
        // );

        chainInfo.transactionPool = [];

        sendMessage(
          produceMessage(TYPE.NEW_BLOCK, chainInfo.latestBlock),
          opened
        ); // Broadcast the new block

        logger.info(
          `LOG :: Block #${chainInfo.latestBlock.blockNumber} mined and synced, state transited.`
        );
      } else {
        mined = false;
      }

      // Re-create the worker thread
      worker.kill();

      worker = fork(`${__dirname}/./miner/worker.js`);
    })
    .catch((err) => logger.error(JSON.stringify(err)));
}

// Function to mine continuously
function loopMine(
  publicKey,
  ENABLE_CHAIN_REQUEST,
  ENABLE_LOGGING,
  time = 6000
) {
  let length = chainInfo.latestBlock.blockNumber;
  let mining = true;

  setInterval(async () => {
    if (mining || length !== chainInfo.latestBlock.blockNumber) {
      mining = false;
      length = chainInfo.latestBlock.blockNumber;

      if (!ENABLE_CHAIN_REQUEST) await mine(publicKey, ENABLE_LOGGING);
    }
  }, time);
}
module.exports = { startServer };
