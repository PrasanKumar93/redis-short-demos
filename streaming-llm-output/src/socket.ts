import { v4 as uuidv4 } from "uuid";

import { Server } from "socket.io";
import { ChatOpenAI } from "@langchain/openai";

import * as redisUtils from "./utils/redis-wrapper.js";
import { LoggerCls } from "./utils/logger.js";
import { OPENAI_STREAM, askQuestion } from "./question.js";

const initSocket = async (socketServer: Server, model: ChatOpenAI) => {
  const activeListeners = new Map<string, boolean>();

  socketServer.on("connection", (socket) => {
    LoggerCls.info("a user connected");

    socket.on("askQuestion", async ({ topic, topicQuestion }) => {
      // Set the active listener state for this client
      const clientId = socket.id;
      activeListeners.set(clientId, true);
      const questionId = uuidv4();

      //lastId to prevent re scan of prev question (or use consumer groups)
      const lastId = await redisUtils.getLastIdOfStream(OPENAI_STREAM);
      LoggerCls.debug("lastId", lastId);
      //trigger the question async
      askQuestion(model, questionId, topic, topicQuestion);

      // Listen for new messages on the Redis stream
      const startChunk = `START:${questionId};`;
      const endChunk = `;END:${questionId}`;
      redisUtils.readStream(
        OPENAI_STREAM,
        lastId,
        startChunk,
        endChunk,
        clientId,
        activeListeners,
        (data) => {
          LoggerCls.info(data.chunkOutput);
          // Emit the chunk to the client (browser)
          socket.emit("chunk", data.chunkOutput);
        }
      );
    });

    socket.on("disconnect", () => {
      LoggerCls.info("user disconnected");
      // Set the listener as inactive on disconnect
      activeListeners.set(socket.id, false);
    });
  });
};

export { initSocket };
