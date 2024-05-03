import type { Document } from './misc/types';

import { SearchApiLoader } from 'langchain/document_loaders/web/searchapi';

import config from './misc/config';
import * as redisUtils from './misc/redis-wrapper';


async function getVideosTranscript(videoIds: string[]) {
    let retDocs: Document[] = [];

    if (videoIds?.length) {
        for (let videoId of videoIds) {
            const loader = new SearchApiLoader({
                engine: 'youtube_transcripts',
                video_id: videoId,
                apiKey: config.search.API_KEY ?? '',
            });

            try {
                const [doc] = await loader.load();
                doc.metadata = {
                    link: `https://www.youtube.com/watch?v=${videoId}`,
                    id: videoId,
                };
                console.log(doc);

                retDocs.push(doc)

            } catch (e) {
                console.error(`Error loading transcript for ${videoId}`, e);
            }

        }
    }

    return retDocs;
}


const init = async () => {
    await redisUtils.setConnection(config.redis.REDIS_URL);

    const videoIds = config.youtube.VIDEOS;
    const results: Document[] = await getVideosTranscript(videoIds);

    //add results to redis
    if (results?.length) {
        for (let transcript of results) {
            const key = `${config.redis.VIDEO_TRANSCRIPT_PREFIX}${transcript.metadata.id}`;
            await redisUtils.set(key, JSON.stringify(transcript));
        }
    }

    await redisUtils.closeConnection();

}

init();