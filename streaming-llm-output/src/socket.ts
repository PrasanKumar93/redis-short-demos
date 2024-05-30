import { Server } from "socket.io";
import { ChatOpenAI } from "@langchain/openai";

import { initSocketXRead } from "./socket-x-read.js";
import { initSocketXReadGroup } from "./socket-x-read-group.js";
import { CONFIG } from "./config.js";
import { LoggerCls } from "./utils/logger.js";

const initSocket = async (socketServer: Server, model: ChatOpenAI) => {
  if (CONFIG.useXRead) {
    LoggerCls.info("Using xRead");
    await initSocketXRead(socketServer, model);
  } else {
    LoggerCls.info("Using xReadGroup");
    await initSocketXReadGroup(socketServer, model);
  }
};

export { initSocket };
