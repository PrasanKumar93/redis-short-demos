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
        indexName: config.redis.VIDEO_SUMMARY_VECTOR_INDEX_NAME,
        keyPrefix: config.redis.VIDEO_SUMMARY_VECTOR_PREFIX,
        indexOptions: {
            ALGORITHM: VectorAlgorithms.HNSW,
            DISTANCE_METRIC: 'IP',
        },
    });

    return vectorStore;
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
        //convert summaries to vectors and add to redis
        const vectorStore = getSummaryRedisVectorStore(client);
        //@ts-ignore
        await vectorStore.addDocuments(summaries);
        console.log('Summary vectors added to redis');
    }

    await redisUtils.closeConnection();

}

init();