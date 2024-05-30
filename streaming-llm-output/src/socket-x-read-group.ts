import type { IMessageHandler } from "./utils/redis-wrapper.js";

import { v4 as uuidv4 } from "uuid";

import { Server } from "socket.io";
import { ChatOpenAI } from "@langchain/openai";

import * as redisUtils from "./utils/redis-wrapper.js";
import { LoggerCls } from "./utils/logger.js";
import { askQuestion } from "./question.js";
import { CONFIG } from "./config.js";

const initSocketXReadGroup = async (
  socketServer: Server,
  model: ChatOpenAI
) => {
  const activeListeners = new Map<string, boolean>();

  socketServer.on("connection", (socket) => {
    LoggerCls.info("a user connected");
    activeListeners.set(socket.id, true);

    const messageCallback: IMessageHandler = (message, messageId) => {
      LoggerCls.info("-: " + message.chunkOutput);
      socket.emit("chunk", message.chunkOutput); // Emit chunk to client (browser)
    };

    socket.on("askQuestion", async ({ topic, topicQuestion }) => {
      const userId = "USER1"; //example user id

      const questionId = "Q-" + uuidv4();
      const streamName = `${CONFIG.OPENAI_STREAM}:${userId}`;
      askQuestion(model, questionId, topic, topicQuestion, streamName); //trigger async

      // Listen for new messages on the Redis stream and pass it to messageCallback
      const startChunk = `START:${questionId};`;
      const endChunk = `;END:${questionId}`;
      redisUtils.listenToStreamsByReadGroup(
        {
          streams: [
            {
              streamKeyName: `${CONFIG.OPENAI_STREAM}:${userId}`,
              messageCallback: messageCallback,
            },
          ],
          groupName: `${CONFIG.OPENAI_STREAM}_Grp_${userId}`,
          consumerName: `${CONFIG.OPENAI_STREAM}_Con_${userId}`,
          maxNoOfEntriesToReadAtTime: 1,
        },
        socket.id,
        activeListeners,
        startChunk,
        endChunk
      );
    });

    socket.on("disconnect", () => {
      LoggerCls.info("user disconnected");
      activeListeners.set(socket.id, false);
    });
  });
};

export { initSocketXReadGroup };
