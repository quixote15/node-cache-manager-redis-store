import {createClient, createCluster} from 'redis';

export async function redisStore(config) {
  const redisCache = createClient(config);
  await redisCache.connect();

  return buildRedisStoreWithConfig(redisCache, config);
}

export async function redisClusterStore(config) {
  const redisCache = createCluster(config)
  await redisCache.connect()

  return buildRedisStoreWithConfig(redisCache, config)
}

export async function redisAdaptativeConnection(...configs) {
  for(let configIndex = 0; configIndex < configs.length; configIndex++) {
    const config = configs[configIndex]
    if(config.socket) {
      try {
        const store = await redisStore(config)
        console.log('Connected to Master/Slave', process.pid)
        return store
      } catch (e) {
        console.info(`Could not connect master/slave with configuration at index:[${configIndex}]`)
      }
    } else if(config.rootNodes) {
      try {
        const store = await redisClusterStore(config)
        console.log('Connected to Store', process.pid)
        return store
      } catch (e) {
        console.info(`Could not connect Cluster with configuration at index:[${configIndex}]`)
      }
    } else {
      throw 'Missing socket or rootNodes field'
    }
  }
  throw 'None of the configurations lead to a proper connection'
}

const buildRedisStoreWithConfig = (redisCache, config) => {
  const isCacheableValue =
    config.isCacheableValue || (value => value !== undefined && value !== null);
  const set = async (key, value, options) => {
    if (!isCacheableValue(value)) {
      throw new Error(`"${value}" is not a cacheable value`);
    }

    const ttl = (options?.ttl || options?.ttl === 0) ? options.ttl : config.ttl;

    if (ttl) {
      return redisCache.setEx(key, ttl, encodeValue(value));
    } else {
      return redisCache.set(key, encodeValue(value));
    }
  };
  const get = async (key, options) => {
    const val = await redisCache.get(key);

    if (val === null) {
      return null;
    }
    return options.parse !== false ? decodeValue(val) : val;
  };
  const del = async (args) => {
    let options = {};
    if (isObject(args.at(-1))) {
      options = args.pop();
    }
    return redisCache.del(args);
  };
  const mset = async (args) => {
    let options = {};
    if (isObject(args.at(-1))) {
      options = args.pop();
    }
    const ttl = (options.ttl || options.ttl === 0) ? options.ttl : config.ttl;

    // Zips even and odd array items into tuples
    const items = args
      .map((key, index) => {
        if (index % 2 !== 0) return null;
        const value = args[index + 1];
        if (!isCacheableValue(value)) {
          throw new Error(`"${value}" is not a cacheable value`);
        }
        return [key, encodeValue(value)];
      })
      .filter((key) => key !== null);

    if (ttl) {
      const multi = redisCache.multi();
      for (const kv of items) {
        const [key, value] = kv;
        multi.setEx(key, ttl, value);
      }
      return multi.exec();
    } else {
      return redisCache.mSet(items);
    }
  };
  const mget = async (...args) => {
    let options = {};
    if (isObject(args.at(-1))) {
      options = args.pop();
    }
    return redisCache
      .mGet(args)
      .then((res) =>
        res.map((val) => {
          if (val === null) {
            return null;
          }

          return options.parse !== false ? decodeValue(val) : val;
        }),
      );
  };
  const mdel = async (...args) => {
    let options = {};
    if (isObject(args.at(-1))) {
      options = args.pop();
    }
    if (Array.isArray(args)) {
      args = args.flat();
    }
    return redisCache.del(args);
  };
  const reset = async () => {
    const couldFlush = redisCache.flushDb
    if(!couldFlush) {
      throw 'Cannot Reset'
    }
    return redisCache.flushDb();
  };
  const keys = async (pattern) => {
    const hasKeys = redisCache.keys
    if(!hasKeys) {
      throw 'Has No Keys Function'
    }
    return redisCache.keys(pattern);
  };
  const ttl = async (key) => {
    return redisCache.ttl(key);
  };

  return {
    name: 'redis',
    getClient: () => redisCache,
    isCacheableValue,
    set: (key, value, options) => {
      options = options || {};

      return set(key, value, options);
    },
    get: (key, options, cb) => {
      if (typeof options === 'function') {
        cb = options;
        options = {};
      }
      options = options || {};

      return get(key, options);
    },
    del: (...args) => {
      return del(args);
    },
    mset: (...args) => {
      return mset(args);
    },
    mget: (...args) => {
      return mget(...args);
    },
    mdel: (...args) => {
      return mdel(...args);
    },
    reset,
    keys: (pattern = '*', cb) => {
      return keys(pattern);
    },
    ttl: (key) => {
      return ttl(key);
    },
  };
};

function encodeValue(value) {
  return JSON.stringify(value) || '"undefined"';
}

function decodeValue(val) {
  return JSON.parse(val);
}

function isObject(object) {
  return typeof object === 'object'
    && !Array.isArray(object)
    && object !== null;
}
