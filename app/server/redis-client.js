import redis from 'redis';
import RedisStore from "connect-redis";

let client;

export async function getRedisClient() {
    if (!client && !client?.isOpen) {
        client = redis.createClient({
            socket: {
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379
            }
        });

        client.on('error', err =>
            console.error('Redis Client Error:', err)
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
        console.log('Redis Session Config created and connection is established.');
        return sessionConfig;
    }
    return undefined

}