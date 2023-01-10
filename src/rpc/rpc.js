"use strict";

const { Transaction } = require("../cores/index");
const { logger } = require("../utils");
const fastify = require("fastify")();

function rpc(PORT, client, transactionHandler, keyPair, stateDB, blockDB) {
  process.on("uncaughtException", (err) => logger.error(err));

  fastify.get("/:option", async (req, reply) => {
    function throwError(message, status, payload = null) {
      reply.status(status);

      reply.send({
        success: false,
        payload: null,
        error: { message },
      });
    }

    function respond(payload) {
      reply.send({
        success: true,
        payload,
      });
    }

    switch (req.params.option) {
      case "get_blockNumber":
        respond({
          blockNumber: Math.max(
            ...(await blockDB.keys().all()).map((key) => parseInt(key))
          ),
        });
        break;

      case "get_address":
        respond({ address: client.publicKey });
        break;

      case "get_work":
        const latestBlock = await blockDB.get(
          Math.max(
            ...(await blockDB.keys().all()).map((key) => parseInt(key))
          ).toString()
        );

        respond({
          hash: latestBlock.hash,
          nonce: latestBlock.nonce,
        });
        break;

      case "mining":
        respond({ mining: client.mining });
        break;

      case "get_voteResult":
        const parties = [];
        const blockscount = Math.max(
          ...(await blockDB.keys().all()).map((key) => parseInt(key))
        );
        for (let i = 1; i <= blockscount; i++) {
          const element = await blockDB.get(i.toString());
          if (element.transactions.length < 0) {
            continue;
          }

          for (let k = 0; k < element.transactions.length; k++) {
            const tx = element.transactions[k];
            if (!parties.find((x) => x.partyID == tx.data.partyID)) {
              parties.push({ partyID: tx.data.partyID, result: 1 });
            } else {
              parties.find((x) => x.partyID == tx.data.partyID).result++;
            }
          }
        }
        respond({ results: parties });
        break;
      default:
        throwError("Invalid option.", 404);
    }
  });

  fastify.post("/:option", async (req, reply) => {
    function throwError(message, status, payload = null) {
      reply.status(status);

      reply.send({
        success: false,
        payload: null,
        error: { message },
      });
    }

    function respond(payload) {
      reply.send({
        success: true,
        payload,
      });
    }

    switch (req.params.option) {
      case "get_blockByHash":
        if (
          typeof req.body.params !== "object" ||
          typeof req.body.params.hash !== "string"
        ) {
          throwError("Invalid request.");
        } else {
          const keys = await blockDB.keys().all();

          for (const [index, key] of keys.entries()) {
            const block = await blockDB.get(key);

            if (index === keys.length - 1) {
              throwError("Invalid block hash.", 400);
            }

            if (block.hash === req.body.params.hash) {
              respond({ block });
            }
          }
        }

        break;

      case "get_blockByNumber":
        if (
          typeof req.body.params !== "object" ||
          typeof req.body.params.blockNumber !== "number"
        ) {
          throwError("Invalid request.");
        } else {
          const currentBlockNumber = Math.max(
            ...(await blockDB.keys().all()).map((key) => parseInt(key))
          );

          if (
            req.body.params.blockNumber <= 0 ||
            req.body.params.blockNumber > currentBlockNumber
          ) {
            throwError("Invalid block number.", 400);
          } else {
            const block = await blockDB.get(
              req.body.params.blockNumber.toString()
            );

            respond({ block });
          }
        }

        break;

      case "get_blockTransactionCountByHash":
        if (
          typeof req.body.params !== "object" ||
          typeof req.body.params.hash !== "string"
        ) {
          throwError("Invalid request.", 400);
        } else {
          const keys = await blockDB.keys().all();

          for (const [index, key] of keys.entries()) {
            const block = await blockDB.get(key);

            if (index === keys.length - 1) {
              throwError("Invalid block hash.", 400);
            }

            if (block.hash === req.body.params.hash) {
              respond({ count: block.transactions.length });
            }
          }
        }

        break;

      case "get_blockTransactionCountByNumber":
        if (
          typeof req.body.params !== "object" ||
          typeof req.body.params.blockNumber !== "number"
        ) {
          throwError("Invalid request.", 400);
        } else {
          const currentBlockNumber = Math.max(
            ...(await blockDB.keys().all()).map((key) => parseInt(key))
          );

          if (
            req.body.params.blockNumber <= 0 ||
            req.body.params.blockNumber > currentBlockNumber
          ) {
            throwError("Invalid block number.", 400);
          } else {
            const block = await blockDB.get(
              req.body.params.blockNumber.toString()
            );

            respond({ count: block.transactions.length });
          }
        }

        break;

      case "get_transactionByBlockNumberAndIndex":
        if (
          typeof req.body.params !== "object" ||
          typeof req.body.params.blockNumber !== "number" ||
          typeof req.body.params.index !== "number"
        ) {
          throwError("Invalid request.", 400);
        } else {
          const currentBlockNumber = Math.max(
            ...(await blockDB.keys().all()).map((key) => parseInt(key))
          );

          if (
            req.body.params.blockNumber <= 0 ||
            req.body.params.blockNumber > currentBlockNumber
          ) {
            throwError("Invalid block number.", 400);
          } else {
            const block = await blockDB.get(
              req.body.params.blockNumber.toString()
            );

            if (
              req.body.params.index < 0 ||
              req.body.params.index >= block.transactions.length
            ) {
              throwError("Invalid transaction index.", 400);
            } else {
              respond({
                transaction: block.transactions[req.body.params.index],
              });
            }
          }
        }

        break;

      case "get_transactionByBlockHashAndIndex":
        if (
          typeof req.body.params !== "object" ||
          typeof req.body.params.hash !== "string" ||
          typeof req.body.params.index !== "number"
        ) {
          throwError("Invalid request.", 400);
        } else {
          const keys = await blockDB.keys().all();

          for (const [index, key] of keys.entries()) {
            const block = await blockDB.get(key);

            if (index === keys.length - 1) {
              throwError("Invalid block hash.", 400);
            }

            if (block.hash === req.body.params.hash) {
              if (
                req.body.params.index < 0 ||
                req.body.params.index >= block.transactions.length
              ) {
                throwError("Invalid transaction index.", 400);
              } else {
                respond({
                  transaction: block.transactions[req.body.params.index],
                });
              }
            }
          }
        }

        break;

      case "sendTransaction":
        if (
          typeof req.body.params !== "object" ||
          typeof req.body.params.transaction !== "object"
        ) {
          throwError("Invalid request.", 400);
        } else {
          respond({ message: "tx received." });

          await transactionHandler(
            req.body.params.transaction,
            client.MY_ADDRESS
          );
        }

        break;

      case "signTransaction":
        if (
          typeof req.body.params !== "object" ||
          typeof req.body.params.transaction !== "object"
        ) {
          throwError("Invalid request.", 400);
        } else {
          const transaction = req.body.params.transaction;
          Transaction.sign(transaction, keyPair);

          respond({ transaction });
        }

        break;
      default:
        throwError("Invalid option.", 404);
    }
  });

  fastify.listen(PORT, (err, address) => {
    if (err) {
      logger.error(`Error at RPC server: Fastify:${JSON.stringify(err)}`);

      process.exit(1);
    }

    logger.info(`LOG :: RPC server running on PORT ${PORT}`);
  });
}

module.exports = rpc;
