import { Document } from 'langchain/document';
import { TokenTextSplitter } from 'langchain/text_splitter';
import { loadSummarizationChain } from 'langchain/chains';
import { ChatOpenAI } from '@langchain/openai';

import config from './misc/config';
import * as redisUtils from './misc/redis-wrapper';
import { SUMMARY_PROMPT, SUMMARY_REFINE_PROMPT } from './prompt-templates/summary-template';

const llm = new ChatOpenAI({
    openAIApiKey: config.openai.API_KEY,
    modelName: config.openai.SUMMARY_MODEL,
    configuration: {
        organization: config.openai.ORGANIZATION,
    },
});

const videoSummarizeChain = loadSummarizationChain(llm, {
    type: 'refine',
    questionPrompt: SUMMARY_PROMPT,
    refinePrompt: SUMMARY_REFINE_PROMPT,
});

async function getTranscriptsSummary(videoIds: string[]) {
    let retDocs: Document[] = [];

    if (videoIds?.length) {
        for (let videoId of videoIds) {

            const transcriptKey = `${config.redis.VIDEO_TRANSCRIPT_PREFIX}${videoId}`;
            const transcriptStr = await redisUtils.get(transcriptKey);

            if (transcriptStr) {
                let transcript: Document = JSON.parse(transcriptStr);

                const splitter = new TokenTextSplitter({
                    chunkSize: 10000,
                    chunkOverlap: 250,
                });
                const transcriptSmallChunks = await splitter.splitDocuments([transcript]);
                const summary = await videoSummarizeChain.run(transcriptSmallChunks);
                console.log('summary:', summary);

                retDocs.push(
                    new Document({
                        metadata: {
                            id: videoId,
                        },
                        pageContent: summary,
                    }),
                );

            }

        }

    }

    return retDocs;
}

const init = async () => {

    const videoIds = config.youtube.VIDEOS;
    await redisUtils.setConnection(config.redis.REDIS_URL);

    const results: Document[] = await getTranscriptsSummary(videoIds);

    //add results to redis
    if (results?.length) {
        for (let summary of results) {
            const key = `${config.redis.VIDEO_SUMMARY_PREFIX}${summary.metadata.id}`;
            await redisUtils.set(key, JSON.stringify(summary));
        }
    }

    await redisUtils.closeConnection();

}

init();