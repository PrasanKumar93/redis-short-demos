import { commandOptions, createClient } from "redis";

import { LoggerCls } from "./logger.js";

interface IMessageHandler {
  (message: any, messageId: string): void;
}

interface ListenStreamOptions {
  streams: {
    streamKeyName: string;
    messageCallback: IMessageHandler;
  }[];
  groupName: string;
  consumerName: string;
  maxNoOfEntriesToReadAtTime?: number;
}

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

async function setJsonItem(_key: string, _value: any) {
  const result = await nodeRedisClient?.set(_key, JSON.stringify(_value));
  return result;
}

async function addItemToStream(streamKey: string, item: any) {
  let insertedId = "";
  try {
    const client = getConnection();
    if (streamKey && item && client) {
      const id = "*"; //* = auto generate
      insertedId = await client.xAdd(streamKey, id, item);
      //@ts-ignore
      // insertedId = await Promise.race([
      //   client.xAdd(streamKey, id, item),
      //   new Promise((_, reject) =>
      //     setTimeout(() => reject(new Error("Timeout")), 1000)
      //   ),
      // ]);
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
  clientId: string,
  activeListeners: Map<string, boolean>,
  callback: (data: any, id?: string) => void
) {
  let reading = false;

  //safe check for Active Client if while loop didn't break for some reason (e.g. chunkOutput.endsWith didn't match endChunk) but client disconnected
  const isActiveClient = activeListeners.get(clientId);
  //while(true)
  while (isActiveClient) {
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

              if (item?.message?.chunkOutput.endsWith(endChunk)) {
                console.log("End of chunk found");
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

const createStreamConsumerGroup = async (
  streamKeyName: string,
  groupName: string
) => {
  const idInitialPosition = "0"; //0 = start, $ = end or any specific id

  try {
    await nodeRedisClient?.xGroupCreate(
      streamKeyName,
      groupName,
      idInitialPosition,
      {
        MKSTREAM: true,
      }
    );

    LoggerCls.info(
      `Created consumer group ${groupName} in stream ${streamKeyName}`
    );
  } catch (err) {
    LoggerCls.error(
      `Consumer group ${groupName} already exists in stream ${streamKeyName}!`
    ); //, err
  }
};

const listenToStreamsByReadGroup = async (
  options: ListenStreamOptions,
  clientId: string,
  activeListeners: Map<string, boolean>
) => {
  /*
     (A) create consumer group for the stream
     (B) read set of messages from the stream
     (C) process all messages received
     (D) trigger appropriate callback for each message
     (E) acknowledge individual messages after processing
    */
  if (nodeRedisClient) {
    const streams = options.streams;
    const groupName = options.groupName;
    const consumerName = options.consumerName;
    const readMaxCount = options.maxNoOfEntriesToReadAtTime || 100;
    const streamKeyIdArr: {
      key: string;
      id: string;
    }[] = [];

    streams.map(async (stream) => {
      // (A) create consumer group for the stream
      await createStreamConsumerGroup(stream.streamKeyName, groupName);

      streamKeyIdArr.push({
        key: stream.streamKeyName,
        id: ">", // Next entry ID that no consumer in this group has read
      });
    });

    LoggerCls.info(`Starting consumer ${consumerName}.`);

    const isActiveClient = activeListeners.get(clientId);
    while (isActiveClient) {
      try {
        // (B) read set of messages from different streams
        const dataArr = await nodeRedisClient.xReadGroup(
          commandOptions({
            isolated: true,
          }),
          groupName,
          consumerName,
          //can specify multiple streams in array [{key, id}]
          streamKeyIdArr,
          {
            COUNT: readMaxCount, // Read n entries at a time
            BLOCK: 0, //block for 0 (infinite) seconds if there are none.
          }
        );

        // sample dataArr
        // dataArr = [
        //   {
        //     name: 'streamName',
        //     messages: [
        //       {
        //         id: '1642088708425-0',
        //         message: {
        //           key1: 'value1',
        //         },
        //       },
        //     ],
        //   },
        // ];

        //(C) process all messages received
        if (dataArr && dataArr.length) {
          for (let data of dataArr) {
            for (let messageItem of data.messages) {
              const streamKeyName = data.name;

              // to get the messageCallback for the stream name
              const stream = streams.find(
                (s) => s.streamKeyName == streamKeyName
              );

              if (stream && messageItem.message) {
                const messageHandler = stream.messageCallback;

                if (messageHandler) {
                  // (D) trigger appropriate action callback for each message

                  await messageHandler(messageItem.message, messageItem.id);
                }
                //(E) acknowledge individual messages after processing
                await nodeRedisClient.xAck(
                  streamKeyName,
                  groupName,
                  messageItem.id
                );
              }
            }
          }
        } else {
          // LoggerCls.info('No new stream entries.');
        }
      } catch (err) {
        console.error(err);
        LoggerCls.error("xReadGroup error !", err);
      }
    }
  }
};

export {
  setConnection,
  getConnection,
  closeConnection,
  getKeys,
  set,
  get,
  setJsonItem,
  addItemToStream,
  readStream,
  getLastIdOfStream,
  listenToStreamsByReadGroup,
};

export type { IMessageHandler };
