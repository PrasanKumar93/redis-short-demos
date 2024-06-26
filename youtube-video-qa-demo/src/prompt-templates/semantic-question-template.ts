import { PromptTemplate } from '@langchain/core/prompts';

const questionTemplate = `
You are an expert in summarizing questions.
Your goal is to reduce a question down to its simplest form while still retaining the semantic meaning. Try to be as deterministic as possible.
Below you find the question:
--------
{question}
--------

Total output will be a semantically similar question that will be used to search an existing dataset.

SEMANTIC QUESTION:
`;

export const SEMANTIC_QUESTION_PROMPT = PromptTemplate.fromTemplate(questionTemplate);
