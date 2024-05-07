import { RedisVectorStore } from '@langchain/redis';
import { VectorAlgorithms } from 'redis';
import { OpenAIEmbeddings } from '@langchain/openai';

import config from './misc/config';
import * as redisUtils from './misc/redis-wrapper';

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
        // Name of the index for storing vectors
        indexName: config.redis.VIDEO_SUMMARY_VECTOR_INDEX_NAME,
        // Prefix for keys used in Redis
        keyPrefix: config.redis.VIDEO_SUMMARY_VECTOR_PREFIX,
        indexOptions: {
            // Algorithm for indexing vectors
            ALGORITHM: VectorAlgorithms.HNSW,
            // Distance metric for comparing vectors
            DISTANCE_METRIC: 'IP',
        },
    });

    return vectorStore;

    /*
      Hierarchical Navigable Small World graphs (HNSW). : Efficient similarity search in high-dimensional spaces
     Inner Product (IP) :  is a common metric used in vector similarity calculations.
     https://redis.io/learn/howtos/solutions/vector/getting-started-vector
    */
}

async function getSummaries(videoIds: string[]) {
    const summaryDocs: Document[] = [];

    if (videoIds?.length) {

        for (let videoId of videoIds) {

            const summaryKey = `${config.redis.VIDEO_SUMMARY_PREFIX}${videoId}`;
            const summaryStr = await redisUtils.get(summaryKey);

            if (summaryStr) {
                let summary = JSON.parse(summaryStr);
                summaryDocs.push(summary);
            }
        }

    }

    return summaryDocs;
}


const init = async () => {
    await redisUtils.setConnection(config.redis.REDIS_URL);
    const client = redisUtils.getConnection()

    const videoIds = config.youtube.VIDEOS;
    const summaries = await getSummaries(videoIds);

    if (summaries?.length && client) {
        // Creating a RedisVectorStore instance for summary vectors
        const vectorStore = getSummaryRedisVectorStore(client);
        //@ts-ignore
        // Adding document vectors to Redis
        await vectorStore.addDocuments(summaries);
        console.log('Summary vectors added to redis');
    }

    await redisUtils.closeConnection();

}

init();