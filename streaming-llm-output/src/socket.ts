import type { IMessageHandler } from "./utils/redis-wrapper";

import { v4 as uuidv4 } from "uuid";

import { Server } from "socket.io";
import { ChatOpenAI } from "@langchain/openai";

import * as redisUtils from "./utils/redis-wrapper.js";
import { LoggerCls } from "./utils/logger.js";
import { OPENAI_STREAM, askQuestion } from "./question.js";

const listenStream = (
  socket: any,
  activeListeners: Map<string, boolean>,
  messageCallback: IMessageHandler
) => {
  const clientId = socket.id;
  activeListeners.set(clientId, true);

  // listen redis stream for new messages
  redisUtils.listenToStreamsByReadGroup(
    {
      streams: [
        {
          streamKeyName: OPENAI_STREAM,
          messageCallback: messageCallback,
        },
      ],
      groupName: OPENAI_STREAM + "_Grp",
      consumerName: OPENAI_STREAM + "_Con",
      maxNoOfEntriesToReadAtTime: 1,
    },
    clientId,
    activeListeners
  );
};

const initSocket = async (socketServer: Server, model: ChatOpenAI) => {
  const activeListeners = new Map<string, boolean>();

  socketServer.on("connection", (socket) => {
    LoggerCls.info("a user connected");
    listenStream(socket, activeListeners, (message, messageId) => {
      LoggerCls.info("-: " + message.chunkOutput);
      socket.emit("chunk", message.chunkOutput); // Emit chunk to client
    });

    socket.on("askQuestion", async ({ topic, topicQuestion }) => {
      const questionId = uuidv4();
      askQuestion(model, questionId, topic, topicQuestion); //trigger async
    });

    socket.on("disconnect", () => {
      LoggerCls.info("user disconnected");
      activeListeners.set(socket.id, false);
    });
  });
};

export { initSocket };

/*
 TODO: 
 - Have per user stream 
*/
