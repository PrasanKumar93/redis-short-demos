import { Document } from 'langchain/document';
import { TokenTextSplitter } from 'langchain/text_splitter';
import { loadSummarizationChain } from 'langchain/chains';
import { ChatOpenAI } from '@langchain/openai';

import config from './misc/config';
import * as redisUtils from './misc/redis-wrapper';
import { SUMMARY_PROMPT, SUMMARY_REFINE_PROMPT } from './prompt-templates/summary-template';

async function getTranscriptSummary(videoIds: string[]) {
    // Initializing a ChatOpenAI instance
    const llm = new ChatOpenAI({
        openAIApiKey: config.openai.API_KEY,
        modelName: config.openai.SUMMARY_MODEL,
        configuration: {
            organization: config.openai.ORGANIZATION,
        },
    });

    // Loading a summarization chain for refining summaries
    const videoSummarizeChain = loadSummarizationChain(llm, {
        type: 'refine',
        questionPrompt: SUMMARY_PROMPT,
        refinePrompt: SUMMARY_REFINE_PROMPT,
    });

    let retDocs: Document[] = [];

    if (videoIds?.length) {
        for (let videoId of videoIds) {

            const transcriptKey = `${config.redis.VIDEO_TRANSCRIPT_PREFIX}${videoId}`;
            const transcriptStr = await redisUtils.get(transcriptKey);

            if (transcriptStr) {
                let transcript: Document = JSON.parse(transcriptStr);

                const splitter = new TokenTextSplitter({
                    chunkSize: 10000, // Maximum number of tokens per chunk
                    chunkOverlap: 250, // Number of tokens overlap between adjacent chunks
                });

                // Splitting the transcript into smaller chunks using the TokenTextSplitter
                const transcriptSmallChunks = await splitter.splitDocuments([transcript]);

                // Generating a summary for the transcript using the summarization chain
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

const addToRedis = async (results: Document[]) => {
    if (results?.length) {
        for (let summary of results) {
            const key = `${config.redis.VIDEO_SUMMARY_PREFIX}${summary.metadata.id}`;
            await redisUtils.set(key, JSON.stringify(summary));
        }
    }
}
const init = async () => {
    await redisUtils.setConnection(config.redis.REDIS_URL);

    const videoIds = config.youtube.VIDEOS;
    const results: Document[] = await getTranscriptSummary(videoIds);

    await addToRedis(results);

    await redisUtils.closeConnection();

}

init();