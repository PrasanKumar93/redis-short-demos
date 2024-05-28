import { commandOptions, createClient } from "redis";

import { LoggerCls } from "./logger.js";

type RedisClientType = ReturnType<typeof createClient>;

let nodeRedisClient: RedisClientType | null = null;

async function setConnection(_connectionURL: string) {
  if (!nodeRedisClient && _connectionURL) {
    nodeRedisClient = createClient({ url: _connectionURL });

    nodeRedisClient.on("error", (err) => {
      LoggerCls.error("Redis Client Error", err);
    });

    await nodeRedisClient.connect();
    LoggerCls.info("redis-wrapper ", "Connected successfully to Redis");
  }
  return nodeRedisClient;
}

function getConnection() {
  return nodeRedisClient;
}

async function closeConnection() {
  if (nodeRedisClient) {
    await nodeRedisClient.disconnect();
  }
}

async function getKeys(_pattern: string) {
  //@ts-ignore
  const result = await nodeRedisClient?.keys(_pattern);
  return result;
}

async function set(_key: string, _value: string) {
  const result = await nodeRedisClient?.set(_key, _value);
  return result;
}

async function get(_key: string) {
  const result = await nodeRedisClient?.get(_key);
  return result;
}

async function addItemToStream(streamKey: string, item: any) {
  let insertedId = "";
  try {
    const client = getConnection();
    if (streamKey && item && client) {
      const id = "*"; //* = auto generate
      // insertedId = await client.xAdd(streamKey, id, item);
      //@ts-ignore
      insertedId = await Promise.race([
        client.xAdd(streamKey, id, item),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), 1000)
        ),
      ]);
      LoggerCls.debug("insertedId", insertedId);
    }
  } catch (err) {
    LoggerCls.error("addItemToStream", err);
  }

  return insertedId;
}

async function getLastIdOfStream(streamKey: string) {
  let lastId = "0-0";
  try {
    if (streamKey) {
      const result = await nodeRedisClient?.xRevRange(streamKey, "+", "-", {
        COUNT: 1,
      });
      if (result && result.length > 0) {
        lastId = result[0].id;
      }
    }
  } catch (err) {
    console.log(err);
  }

  return lastId;
}

async function readStream(
  stream: string,
  lastId: string,
  startChunk: string,
  endChunk: string,
  callback: (data: any, id?: string) => void
) {
  let reading = false;

  while (true) {
    try {
      const results = await nodeRedisClient?.xRead(
        commandOptions({
          isolated: true,
        }),
        { key: stream, id: lastId },
        { BLOCK: 0, COUNT: 1 }
      );

      if (results) {
        for (const result of results) {
          for (const item of result.messages) {
            if (item?.message?.chunkOutput.startsWith(startChunk)) {
              reading = true;
            }

            if (reading) {
              lastId = item.id;
              callback(item.message, lastId);

              if (item?.message?.chunkOutput.startsWith(endChunk)) {
                return;
              }
            }
          }
        }
      }
    } catch (err) {
      LoggerCls.error("readStream", err);
    }
  }
}

export {
  setConnection,
  getConnection,
  closeConnection,
  getKeys,
  set,
  get,
  addItemToStream,
  readStream,
  getLastIdOfStream,
};
