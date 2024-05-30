import { ChatOpenAI } from "@langchain/openai";

import {
  ChatPromptTemplate,
  SystemMessagePromptTemplate,
} from "@langchain/core/prompts";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { StringOutputParser } from "@langchain/core/output_parsers";

import * as redisUtils from "./utils/redis-wrapper.js";
import { LoggerCls } from "./utils/logger.js";

const OPENAI_STREAM = "OPENAI_STREAM";

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
    const startChunkLbl = `START:${_questionId};<br/>`;
    const endChunkLbl = `<br/>;END:${_questionId}`;

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

    // add start chunk to stream
    const questionStartMessageId = await redisUtils.addItemToStream(
      OPENAI_STREAM,
      {
        questionId: _questionId,
        chunkOutput: startChunkLbl,
      }
    );

    // add LLM output chunks to stream
    for await (const chunk of streamHandle) {
      LoggerCls.debug(chunk);

      await redisUtils.addItemToStream(OPENAI_STREAM, {
        questionId: _questionId,
        chunkOutput: chunk.toString(), //runtime  casting
      });
    }

    // add end chunk to stream
    const questionEndMessageId = await redisUtils.addItemToStream(
      OPENAI_STREAM,
      {
        questionId: _questionId,
        chunkOutput: endChunkLbl,
      }
    );

    // add question details/ meta data to redis (for future re-read of stream)
    const questionDetails = {
      topic: _topic,
      topicQuestion: _topicQuestion,
      questionId: _questionId,
      streamName: OPENAI_STREAM,
      streamStartMessageId: questionStartMessageId,
      streamEndMessageId: questionEndMessageId,
    };
    await redisUtils.setJsonItem(`questions:${_questionId}`, questionDetails);
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

    // Invoke the chain and get full output
    output = await chain.invoke({
      topic: _topic,
    });
  }

  return output;
};

export {
  OPENAI_STREAM,
  askQuestion,
  askQuestionWithoutStream,
  getQuestionChain,
};
