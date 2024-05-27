import { commandOptions, createClient } from "redis";

type RedisClientType = ReturnType<typeof createClient>;

let nodeRedisClient: RedisClientType | null = null;

async function setConnection(_connectionURL: string) {
  if (!nodeRedisClient && _connectionURL) {
    nodeRedisClient = createClient({ url: _connectionURL });

    nodeRedisClient.on("error", (err) => {
      console.error("Redis Client Error", err);
    });

    await nodeRedisClient.connect();
    console.info("redis-wrapper ", "Connected successfully to Redis");
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
      console.log("insertedId", insertedId);
    }
  } catch (err) {
    console.log(err);
  }

  return insertedId;
}

async function readStream(
  stream: string,
  lastId: string,
  callback: (data: any) => void
) {
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
            lastId = item.id;
            callback(item.message);

            if (item?.message?.chunkOutput === "END") {
              return;
            }
          }
        }
      }
    } catch (err) {
      console.log(err);
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
};
