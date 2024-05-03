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
    await redisUtils.setConnection(config.redis.REDIS_URL);

    const videoIds = config.youtube.VIDEOS;
    const results = await getVideosInfo(videoIds);

    //add results to redis
    if (results?.length) {
        for (let videoInfo of results) {
            const key = `${config.redis.VIDEO_INFO_PREFIX}${videoInfo.id}`;
            await redisUtils.set(key, JSON.stringify(videoInfo));
        }
    }

    await redisUtils.closeConnection();

}

init();