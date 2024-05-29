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
        chunkOutput: chunk.toString(), //runtime string casting
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

export {
  OPENAI_STREAM,
  askQuestion,
  askQuestionWithoutStream,
  getQuestionChain,
};
