import express from "express";
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

//------------------
const askQuestion = async function (
  _model: ChatOpenAI,
  _questionId: string,
  _topic: string,
  _topicQuestion: string
) {
  if (_model && _topic && _topicQuestion) {
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

    // Stream the output
    let streamHandle = await chain.stream({
      topic: _topic,
    });

    await redisUtils.addItemToStream(OPENAI_STREAM, {
      questionId: _questionId,
      topic: _topic,
      topicQuestion: _topicQuestion,
      chunkOutput: "START",
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
      chunkOutput: "END",
    });
  }
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

  httpServer.listen(3000, () => {
    console.log("listening on *:3000");
  });
};

init();

/*
 TODO: 

 - Add end mark to the stream data with question id prefix 
 - Send only that question answer to the client that was asked by the client
 - clear redis stream data after read
*/
