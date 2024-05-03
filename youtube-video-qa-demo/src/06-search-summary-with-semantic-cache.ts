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

const embeddings = new OpenAIEmbeddings({
    openAIApiKey: config.openai.API_KEY,
    modelName: config.openai.EMBEDDING_MODEL,
    configuration: {
        organization: config.openai.ORGANIZATION,
    },
});

const getSummaryRedisVectorStore = (client) => {
    /**
     * This vector store will match a short question (e.g. "Tell me about streams") with
     * a bank of longer transcript summaries + questions.
     */

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

const getAnswerRedisVectorStore = (client) => {
    /**
        * This vector store will match a short question (e.g. "Tell me about streams") with previously
        * answered questions (e.g. "What is a stream?")
        */
    const vectorStore = new RedisVectorStore(embeddings, {
        redisClient: client,
        indexName: config.redis.ANSWER_INDEX_NAME,
        keyPrefix: config.redis.ANSWER_PREFIX,
        indexOptions: {
            ALGORITHM: VectorAlgorithms.FLAT,
            DISTANCE_METRIC: 'L2',
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

    const videoIds = videos.map((video) => video.metadata.id);

    const answerDocument = new Document({
        metadata: {
            videoIds,
            answer,
        },
        pageContent: question,
    });

    return answerDocument;
}

async function cacheLLMsAnswer(answer: Document) {
    const client = redisUtils.getConnection()
    const vectorStore = getAnswerRedisVectorStore(client);
    await vectorStore.addDocuments([answer]);
}

async function checkAnswerCache(question: string) {
    let retDocs: Document[] = [];
    const client = redisUtils.getConnection()
    const vectorStore = getAnswerRedisVectorStore(client);
    const isIndexExists = await vectorStore.checkIndexExists();

    if (isIndexExists) {

        // Scores will be between 0 and 1, where 0 is most accurate and 1 is least accurate

        let resultsWithScore = await vectorStore.similaritySearchWithScore(question, config.searches.KNN);

        if (resultsWithScore?.length) {
            // Filter out results with too high similarity score
            resultsWithScore = resultsWithScore.filter(
                (entry) => entry[1] <= config.searches.maxSimilarityScore
            );

            console.log('results:', resultsWithScore);

            if (resultsWithScore.length == 0) {
                const inaccurateResults = resultsWithScore.filter(
                    (entry) => entry[1] > config.searches.maxSimilarityScore,
                );
                console.log('inaccurateResults:', inaccurateResults);
            }


            retDocs = resultsWithScore.map((entry) => {
                return entry[0];
            });
        }
    }

    return retDocs;
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

const searchSummaryWithSemanticCache = async (userQuestion: string) => {

    let retDocs: Document[] = [];

    let existingCacheAnswers = await checkAnswerCache(userQuestion); // --- 1

    if (existingCacheAnswers?.length) {
        console.log('Cached answers found');
        retDocs = existingCacheAnswers;
    }
    else {
        console.log('No cached answers found, searching summary');
        const answerDocument = await searchSummary(userQuestion);

        if (answerDocument) {//cache the answer
            await cacheLLMsAnswer(answerDocument); // ---2

            retDocs = [answerDocument];
        }
    }

    return retDocs;
}



const init = async () => {
    await redisUtils.setConnection(config.redis.REDIS_URL);

    // const question = 'Tell me about albert einstein quote?';
    const question = 'Do you have any quote of albert einstein?';

    const answerDocuments = await searchSummaryWithSemanticCache(question);
    if (answerDocuments?.length) {
        answerDocuments.forEach((answerDocument, index) => {
            console.log(`Answer ${index + 1}:`, answerDocument?.metadata?.answer);
        });
    }

    await redisUtils.closeConnection();

}

init();