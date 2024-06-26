import 'dotenv/config';

const ENV = process.env;

export default {
    app: {
        PORT: ENV.PORT ?? 8000,
        NAME: 'video-search',
        VERSION: '0.0.0',
        FULL_NAME: 'video-search@0.0.0',
    },
    searches: {
        KNN: 3,
        maxSimilarityScore: 0.2,
        answerCache: true,
    },
    // log: {
    //     LEVEL: 'info',
    //     STREAM: 'LOGS',
    // },
    env: {
        DEV: typeof ENV.NODE_ENV === 'string' ? ENV.NODE_ENV === 'development' : true,
        PROD: ENV.NODE_ENV === 'production',
        STAGING: ENV.NODE_ENV === 'staging',
    },
    youtube: {
        VIDEOS: (
            ENV.YOUTUBE_VIDEOS ??
            "AJhTduDOVCs,I-ohlZXXaxs,SzcpwtLRgyk,Z8qcpXyMAiA"
        ).split(','),
    },
    redis: {
        REDIS_URL: ENV.REDIS_URL ?? 'redis://localhost:6379',

        VIDEO_INFO_PREFIX: 'video-info:',
        VIDEO_TRANSCRIPT_PREFIX: 'video-transcript:',
        VIDEO_SUMMARY_PREFIX: 'video-summary:',

        VIDEO_SUMMARY_VECTOR_INDEX_NAME: 'idx-video-summary-vector',
        VIDEO_SUMMARY_VECTOR_PREFIX: 'video-summary-vector:',

        ANSWER_INDEX_NAME: 'idx-llm-answer',
        ANSWER_PREFIX: 'llm-answer:',
    },
    search: {
        API_KEY: ENV.SEARCHAPI_API_KEY,
    },
    google: {
        API_KEY: ENV.GOOGLE_API_KEY,

        // PREFIX: 'google',
        // EMBEDDING_MODEL: 'embedding-001',
        // SUMMARY_MODEL: 'gemini-pro',
    },
    openai: {
        API_KEY: ENV.OPENAI_API_KEY,
        ORGANIZATION: ENV.OPENAI_ORGANIZATION,

        PREFIX: 'openai',
        EMBEDDING_MODEL: 'text-embedding-ada-002',// 'gpt-4',
        SUMMARY_MODEL: 'gpt-4-1106-preview', // 'gpt-4',
    }
};
