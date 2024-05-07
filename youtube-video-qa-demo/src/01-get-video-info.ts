import type { VideoInfo } from './misc/types';
import { youtube } from '@googleapis/youtube';

import config from './misc/config';
import * as redisUtils from './misc/redis-wrapper';

const getVideoInfo = async (videoIds: string[]) => {

    // Creating an instance of the YouTube API client
    const youtubeApi = youtube({
        auth: config.google.API_KEY,
        version: 'v3',
    });

    const results: VideoInfo[] = [];

    if (videoIds?.length) {
        // Retrieving information about the videos
        const videoListResponse = await youtubeApi.videos.list({
            id: videoIds,
            part: ['snippet', 'contentDetails'],
        });
        /*
        part: which parts of the video data to be retrieved

        snippet: 
              This part contains basic information about the video, such as its  title, description, thumbnails, and channel title.
        contentDetails: 
              This part contains additional details about the video, such as its duration, upload date, and video definition.
        */

        const { items } = videoListResponse?.data;

        if (items?.length) {

            items.map((item) => {
                const { id, snippet, contentDetails } = item;

                if (id && snippet) {
                    console.log(id, snippet, contentDetails);

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

const addToRedis = async (results: VideoInfo[]) => {
    if (results?.length) {
        for (let videoInfo of results) {
            const key = `${config.redis.VIDEO_INFO_PREFIX}${videoInfo.id}`;
            await redisUtils.set(key, JSON.stringify(videoInfo));
        }
    }
}
const init = async () => {
    await redisUtils.setConnection(config.redis.REDIS_URL);

    const videoIds = config.youtube.VIDEOS;
    const results = await getVideoInfo(videoIds);

    await addToRedis(results);

    await redisUtils.closeConnection();

}

init();