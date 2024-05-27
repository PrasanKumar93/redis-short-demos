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

import { config } from "dotenv";
import * as redisUtils from "./utils/redis-wrapper.js";

//------------------
config();

const OPENAI_STREAM = "OPENAI_STREAM";

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

  console.log("Prompt: \n", await prompt.format({ topic: _topic }));

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
      chunkOutput: "START\n",
    });

    for await (const chunk of streamHandle) {
      console.log(chunk);

      await redisUtils.addItemToStream(OPENAI_STREAM, {
        questionId: _questionId,
        topic: _topic,
        topicQuestion: _topicQuestion,
        chunkOutput: "" + chunk.toString(), //string casting
      });
    }
    await redisUtils.addItemToStream(OPENAI_STREAM, {
      questionId: _questionId,
      topic: _topic,
      topicQuestion: _topicQuestion,
      chunkOutput: "\nEND",
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

    socket.on("askQuestion", async ({ questionId, topic, topicQuestion }) => {
      askQuestion(model, questionId, topic, topicQuestion); //async

      // Listen for new messages on the Redis stream
      let lastId = "0";
      redisUtils.readStream(OPENAI_STREAM, lastId, (data) => {
        socket.emit("chunk", data.chunkOutput);
      });
    });

    socket.on("disconnect", () => {
      console.log("user disconnected");
    });
  });

  app.post("/askQuestionWithoutStream", async (req, res) => {
    const { questionId, topic, topicQuestion } = req.body;
    try {
      const output = await askQuestionWithoutStream(
        model,
        questionId,
        topic,
        topicQuestion
      );
      res.json({ output });
    } catch (error) {
      res.status(500).json({ error: error });
    }
  });

  httpServer.listen(3000, () => {
    console.log("listening on *:3000");
  });
};

init();

/*
 TODO: 

 - Send only that question answer to the client that was asked by the client
 - better to have one stream per question or user ?? , later useful for semantic search ??
 - clear redis stream data after read
*/
