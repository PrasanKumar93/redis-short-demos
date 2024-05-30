import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";

import { ChatOpenAI } from "@langchain/openai";

import { v4 as uuidv4 } from "uuid";

import { config } from "dotenv";
import * as redisUtils from "./utils/redis-wrapper.js";
import { LoggerCls } from "./utils/logger.js";
import { askQuestionWithoutStream } from "./question.js";
import { initSocket } from "./socket.js";

config();

const model = new ChatOpenAI({
  modelName: "gpt-4",
  apiKey: process.env.OPENAI_API_KEY,
});

//---- express server
const app = express();
const httpServer = createServer(app);
const socketServer = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());

app.post("/askQuestionWithoutStream", async (req, res) => {
  const { topic, topicQuestion } = req.body;
  try {
    const questionId = uuidv4();
    const output = await askQuestionWithoutStream(
      model,
      questionId,
      topic,
      topicQuestion
    );
    res.json({ output });
  } catch (error) {
    LoggerCls.error("askQuestionWithoutStream API error", error);
    res.status(500).json({ error: error });
  }
});

httpServer.listen(3000, async () => {
  const REDIS_URL = process.env.REDIS_URL || "";
  await redisUtils.setConnection(REDIS_URL);

  // set up socket server
  initSocket(socketServer, model);

  LoggerCls.info("Backend listening on *:3000");
  LoggerCls.info("Frontend URL is http://127.0.0.1:5400/");
});
//---- express server
