import { ChatOpenAI } from "@langchain/openai";
import {
  ChatPromptTemplate,
  SystemMessagePromptTemplate,
} from "@langchain/core/prompts";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { StringOutputParser } from "@langchain/core/output_parsers";

import { config } from "dotenv";

config();

const askQuestion = async function (
  _model: ChatOpenAI,
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

    for await (const chunk of streamHandle) {
      console.log(chunk); //TODO: add to stream
    }
  }
};

const init = async () => {
  const model = new ChatOpenAI({
    modelName: "gpt-4",
    apiKey: process.env.OPENAI_API_KEY,
  });

  const topic = "Redis";
  const topicQuestion = "What is Streams?";
  await askQuestion(model, topic, topicQuestion);
};

init();
