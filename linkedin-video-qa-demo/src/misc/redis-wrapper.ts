import { createClient } from 'redis';

type RedisClientType = ReturnType<typeof createClient>;

let nodeRedisClient: RedisClientType | null = null;

async function setConnection(_connectionURL: string) {
    if (!nodeRedisClient && _connectionURL) {
        nodeRedisClient = createClient({ url: _connectionURL });

        nodeRedisClient.on('error', (err) => {
            console.error('Redis Client Error', err);
        });

        await nodeRedisClient.connect();
        console.info('redis-wrapper ', 'Connected successfully to Redis');
    }
    return nodeRedisClient;
}

async function getConnection() {
    return nodeRedisClient;
}

async function closeConnection() {
    if (nodeRedisClient) {
        await nodeRedisClient.disconnect();
    }
}

async function getKeys(_pattern: string) {
    //@ts-ignore
    const result = await nodeRedisClient?.keys(_pattern);
    return result;
}

async function set(_key: string, _value: string) {
    const result = await nodeRedisClient?.set(_key, _value);
    return result;
}

async function get(_key: string) {
    const result = await nodeRedisClient?.get(_key);
    return result;
}

export {
    setConnection,
    getConnection,
    closeConnection,
    getKeys,
    set,
    get,
};

