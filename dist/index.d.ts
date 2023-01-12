import type { Store, StoreConfig } from "cache-manager";
import type {RedisClientType, RedisClientOptions, RedisClusterOptions} from "redis";
import RedisCluster from "@redis/client/dist/lib/cluster";

interface RedisStore extends Store {
    name: string;
    getClient: () => RedisClientType;
    isCacheableValue: any;
    set: (key: any, value: any, options: any, cb: any) => Promise<any>;
    get: (key: any, options: any, cb: any) => Promise<any>;
    del: (...args: any[]) => Promise<any>;
    mset: (...args: any[]) => Promise<any>;
    mget: (...args: any[]) => Promise<any>;
    mdel: (...args: any[]) => Promise<any>;
    reset: (cb: any) => Promise<any>;
    keys: (pattern: string, cb: any) => Promise<any>;
    ttl: (key: any, cb: any) => Promise<any>;
}

export function redisStore(config: RedisClientOptions): Promise<RedisStore>;
export function redisClusterStore(config: RedisClusterOptions): Promise<RedisStore>;
export function redisAdaptativeConnection(...config: (RedisClientOptions | RedisClusterOptions)[]): Promise<RedisStore>;
