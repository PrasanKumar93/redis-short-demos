import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";

import { ChatOpenAI } from "@langchain/openai";
import {
  ChatPromptTemplate,
  SystemMessagePromptTemplate,
} from "@langchain/core/prompts";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { v4 as uuidv4 } from "uuid";

import { config } from "dotenv";
import * as redisUtils from "./utils/redis-wrapper.js";
import { LoggerCls } from "./utils/logger.js";

//------------------
config();

const OPENAI_STREAM = "OPENAI_STREAM";
const activeListeners = new Map<string, boolean>();

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

//------------------
const getQuestionChain = async function (
  _model: ChatOpenAI,
  _questionId: string,
  _topic: string,
  _topicQuestion: string
) {
  const outputParser = new StringOutputParser();

  // Create a prompt
  let systemMsg = SystemMessagePromptTemplate.fromTemplate(
    `You are an expert in answering questions about {topic}.
       All questions are about particular topic "{topic}". 
       Make sure your answer is related to {topic}. `
  );
  let humanMsg = new HumanMessage(_topicQuestion);
  const prompt = ChatPromptTemplate.fromMessages([systemMsg, humanMsg]);

  LoggerCls.info("Prompt: \n", await prompt.format({ topic: _topic }));

  // Create a pipeline chain
  const chain = prompt.pipe(_model).pipe(outputParser);

  return chain;
};

const askQuestion = async function (
  _model: ChatOpenAI,
  _questionId: string,
  _topic: string,
  _topicQuestion: string
) {
  if (_model && _topic && _topicQuestion) {
    const chain = await getQuestionChain(
      _model,
      _questionId,
      _topic,
      _topicQuestion
    );

    // Stream the output
    let streamHandle = await chain.stream({
      topic: _topic,
    });

    await redisUtils.addItemToStream(OPENAI_STREAM, {
      questionId: _questionId,
      topic: _topic,
      topicQuestion: _topicQuestion,
      chunkOutput: `START:${_questionId};<br/>`,
    });

    for await (const chunk of streamHandle) {
      LoggerCls.debug(chunk);

      await redisUtils.addItemToStream(OPENAI_STREAM, {
        questionId: _questionId,
        topic: _topic,
        topicQuestion: _topicQuestion,
        chunkOutput: chunk.toString(), //string casting
      });
    }
    await redisUtils.addItemToStream(OPENAI_STREAM, {
      questionId: _questionId,
      topic: _topic,
      topicQuestion: _topicQuestion,
      chunkOutput: `<br/>;END:${_questionId}`,
    });
  }
};

const askQuestionWithoutStream = async function (
  _model: ChatOpenAI,
  _questionId: string,
  _topic: string,
  _topicQuestion: string
) {
  let output = "";
  if (_model && _topic && _topicQuestion) {
    const chain = await getQuestionChain(
      _model,
      _questionId,
      _topic,
      _topicQuestion
    );

    output = await chain.invoke({
      topic: _topic,
    });
  }

  return output;
};

const init = async () => {
  const REDIS_URL = process.env.REDIS_URL || "";
  await redisUtils.setConnection(REDIS_URL);

  const model = new ChatOpenAI({
    modelName: "gpt-4",
    apiKey: process.env.OPENAI_API_KEY,
  });

  socketServer.on("connection", (socket) => {
    console.log("a user connected");

    socket.on("askQuestion", async ({ topic, topicQuestion }) => {
      // Set the active listener state for this client
      const clientId = socket.id;
      activeListeners.set(clientId, true);

      const questionId = uuidv4();

      const lastId = await redisUtils.getLastIdOfStream(OPENAI_STREAM); //to prevent re scan prev question or use consumer groups
      LoggerCls.info("lastId", lastId);
      askQuestion(model, questionId, topic, topicQuestion); //async

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
          socket.emit("chunk", data.chunkOutput);
        }
      );
    });

    socket.on("disconnect", () => {
      LoggerCls.info("user disconnected");
      activeListeners.set(socket.id, false); // Set the listener as inactive on disconnect
    });
  });

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
      console.log(error);
      res.status(500).json({ error: error });
    }
  });

  httpServer.listen(3000, () => {
    LoggerCls.info("Backend: listening on *:3000");
    LoggerCls.info("Frontend URL: http://127.0.0.1:5400/");
  });
};

init();

/*
 TODO: 

  - clean up , formatting frontend (serve from cli on npm start) and back end
 - use consumer groups for reading stream for perf issue
 - add loader in UI
 - tutorial with gif image
 - then live video questioning (ask cody)
*/
