import redis from 'redis';
import RedisStore from "connect-redis";
import Logger from "../util/logger.js";

const logger = Logger.getLogger('redis-client');
let client = null;

export async function getRedisClient() {
    if (!client || !client.isOpen) {
        client = redis.createClient({
            socket: {
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379
            }
        });
        client.on('error', err =>
            logger.error(`Redis Client Error: ${err.code}`)
        );
        await client.connect(); // ✅ only once
    }
    return client;
}

export async function createRedisSessionConfig(secret) {
    const redisClient = await getRedisClient();
    if( redisClient ) {
        const sessionConfig = {
            store: new RedisStore({ client: redisClient }),
            resave: false,
            name: 'stamp-webservices',
            saveUninitialized: false,
            secret: secret,
            cookie: {
                sameSite: 'strict',
                secure: true,
                maxAge: 24 * 60 * 60 * 1000 // 24 hours
            }
        };
        logger.info('Redis Session Config created and connection is established.');
        return sessionConfig;
    }
    return undefined

}