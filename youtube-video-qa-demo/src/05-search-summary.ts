import { Document } from 'langchain/document';
import { ChatOpenAI } from '@langchain/openai';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RedisVectorStore } from '@langchain/redis';
import { VectorAlgorithms } from 'redis';
import { OpenAIEmbeddings } from '@langchain/openai';

import config from './misc/config';
import * as redisUtils from './misc/redis-wrapper';
import { SEMANTIC_QUESTION_PROMPT } from './prompt-templates/semantic-question-template'
import { ANSWER_PROMPT } from './prompt-templates/answer-template';

const llm = new ChatOpenAI({
    openAIApiKey: config.openai.API_KEY,
    modelName: config.openai.SUMMARY_MODEL,
    configuration: {
        organization: config.openai.ORGANIZATION,
    },
});

const getSummaryRedisVectorStore = (client) => {
    const embeddings = new OpenAIEmbeddings({
        openAIApiKey: config.openai.API_KEY,
        modelName: config.openai.EMBEDDING_MODEL,
        configuration: {
            organization: config.openai.ORGANIZATION,
        },
    });


    const vectorStore = new RedisVectorStore(embeddings, {
        redisClient: client,
        indexName: config.redis.VIDEO_SUMMARY_VECTOR_INDEX_NAME,
        keyPrefix: config.redis.VIDEO_SUMMARY_VECTOR_PREFIX,
        indexOptions: {
            ALGORITHM: VectorAlgorithms.HNSW,
            DISTANCE_METRIC: 'IP',
        },
    });

    return vectorStore;
}

async function getSemanticQuestion(question: string) {
    const semanticQuestionChain = SEMANTIC_QUESTION_PROMPT.pipe(llm).pipe(
        new StringOutputParser(),
    );

    const semanticQuestion = await semanticQuestionChain.invoke({
        question,
    });

    console.log('Semantic Question:', semanticQuestion);
    return semanticQuestion;
}

async function similaritySearchOnRedis(question: string) {
    const client = redisUtils.getConnection()
    const vectorStore = getSummaryRedisVectorStore(client);

    const KNN = config.searches.KNN;
    /* Simple standalone search in the vector DB */
    const result = await vectorStore.similaritySearch(question, KNN);

    console.log('similaritySearchOnRedis Result:', result);
    return result;
}

async function answerQuestion(question: string, videos: Document[]) {

    const questionAnswerChain = ANSWER_PROMPT.pipe(llm).pipe(
        new StringOutputParser(),
    );

    const answer = await questionAnswerChain.invoke({
        question,
        data: JSON.stringify(videos),
    });

    const answerDocument = new Document({
        metadata: {
            videos,
            answer,
        },
        pageContent: question,
    });

    return answerDocument;
}

async function searchSummary(userQuestion: string) {
    let answerDocument: Document | null = null;

    const semanticQuestion = await getSemanticQuestion(userQuestion);

    let searchResults = await similaritySearchOnRedis(semanticQuestion);
    if (!searchResults || searchResults.length === 0) {
        console.log('No videos found for semantic question, trying with original question');

        searchResults = await similaritySearchOnRedis(userQuestion);
    }

    if (searchResults?.length) {
        answerDocument = await answerQuestion(userQuestion, searchResults);
    }
    else {
        console.log('No videos found for original question');
    }

    return answerDocument;

}



const init = async () => {
    await redisUtils.setConnection(config.redis.REDIS_URL);

    const question = 'Tell me about albert einstein quote?';

    const answerDocument = await searchSummary(question);
    console.log('Answer:', answerDocument?.metadata?.answer);

    await redisUtils.closeConnection();

}

init();