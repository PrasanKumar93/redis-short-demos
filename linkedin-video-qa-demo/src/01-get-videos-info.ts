import type { VideoInfo } from './misc/types';
import { youtube } from '@googleapis/youtube';

import config from './misc/config';
import * as redisUtils from './misc/redis-wrapper';

const youtubeApi = youtube({
    auth: config.google.API_KEY,
    version: 'v3',
});

const getVideosInfo = async (videoIds: string[]) => {

    const results: VideoInfo[] = [];

    if (videoIds?.length) {
        const videoListResponse = await youtubeApi.videos.list({
            id: videoIds,
            part: ['snippet', 'contentDetails'],
        });

        const { items } = videoListResponse?.data;

        if (items?.length) {

            items.map((item) => {
                const { id, snippet } = item;

                if (id && snippet) {
                    console.log('id:', id);
                    console.log('snippet:', snippet);

                    const videoInfo = {
                        id: id,
                        title: snippet.title ?? '',
                        description: snippet.description ?? '',
                        thumbnail: snippet.thumbnails?.maxres?.url ?? '',
                    };

                    results.push(videoInfo);
                }
            });
        }
    }
    return results;
}

const init = async () => {

    const videoIds = config.youtube.VIDEOS;

    const results = await getVideosInfo(videoIds);

    //add results to redis
    await redisUtils.setConnection(config.redis.REDIS_URL);

    if (results?.length) {
        results.map(async (video) => {
            const key = `${config.redis.VIDEO_PREFIX}${video.id}`;
            await redisUtils.set(key, JSON.stringify(video));
        });
    }

    await redisUtils.closeConnection();

}

init();