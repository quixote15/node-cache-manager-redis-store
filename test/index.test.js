import cacheManager from 'cache-manager';
import {redisClusterStore,redisStore} from '../index';

describe('redisStore initialization', () => {
    let redisCache;
    let customRedisCache;
    
    const config = {
      socket: {
        host: '127.0.0.1',
        port: 6380
      },
      password: undefined,
      db: 0,
      ttl: 5,
    };
    
    beforeEach(async () => {
      redisCache = cacheManager.caching({
        store: await redisStore(config),
      });
      await redisCache.reset();
    
      const customConfig = {
        ...config,
        isCacheableValue: (val) => {
          if (val === undefined) { // allow undefined
            return true;
          } else if (val === 'FooBarString') { // disallow FooBarString
            return false;
          }
          return redisCache.store.isCacheableValue(val);
        }
      };
    
      customRedisCache = cacheManager.caching({
        store: await redisStore(customConfig),
      });
      await customRedisCache.reset();
    });
    
    describe('initialization', () => {
      it('should create a store with the options that were provided', async () => {
        const redisPwdCache = cacheManager.caching({
          store: await redisStore(config),
          ...config
        });
    
        expect(redisPwdCache.store.getClient().options.socket.host).toEqual(config.socket.host);
        expect(redisPwdCache.store.getClient().options.socket.port).toEqual(config.socket.port);
      });
    });
    
    describe('set', () => {
      it('should return a promise', () => {
        expect(redisCache.set('foo', 'bar')).toBeInstanceOf(Promise);
      });
    
      it('should store a value without ttl', async () => {
        await redisCache.set('foo', 'bar');
        await expect(redisCache.get('foo')).resolves.toEqual('bar');
        await expect(redisCache.ttl('foo')).resolves.toEqual(config.ttl);
      });
    
      it('should store a value with a specific ttl', async () => {
        await redisCache.set('foo', 'bar', {ttl: 5});
        await expect(redisCache.ttl('foo')).resolves.toEqual(5);
      });
    
      it('should store a value with a infinite ttl', async () => {
        await redisCache.set('foo', 'bar', {ttl: 0});
        await expect(redisCache.ttl('foo')).resolves.toEqual(-1);
      });
    
      it('should not be able to store a null value (not cacheable)', async () => {
        await expect(redisCache.set('foo', null)).rejects.toThrowError('"null" is not a cacheable value');
      });
    
      it('should not store an invalid value', async () => {
        await expect(redisCache.set('foo1', undefined)).rejects.toThrowError('"undefined" is not a cacheable value');
      });
    
      it('should store an undefined value if permitted by isCacheableValue', async () => {
        expect(customRedisCache.store.isCacheableValue(undefined)).toBe(true);
        await customRedisCache.set('foo3', undefined);
      });
    
      it('should not store a value disallowed by isCacheableValue', async () => {
        expect(customRedisCache.store.isCacheableValue('FooBarString')).toBe(false);
        await expect(customRedisCache.set('foobar', 'FooBarString')).rejects.toThrowError('"FooBarString" is not a cacheable value');
      });
    
      it('should return an error if there is an error acquiring a connection', async () => {
        await redisCache.store.getClient().disconnect();
        await expect(redisCache.set('foo', 'bar')).rejects.toBeDefined();
      });
    });
    
    describe('get', () => {
      it('should return a promise', async () => {
        expect(redisCache.get('foo')).toBeInstanceOf(Promise);
      });
    
      it('should retrieve a value for a given key', async () => {
        const value = 'bar';
        await redisCache.set('foo', value);
        await expect(redisCache.get('foo')).resolves.toEqual(value);
      });
    
      it('should retrieve a value for a given key if options provided', async () => {
        const value = 'bar';
        await redisCache.set('foo', value);
        await expect(redisCache.get('foo', {})).resolves.toEqual(value);
      });
    
      it('should retrieve a value for a given key unparsed', async () => {
        const value = 'bar';
        await redisCache.set('foo', value);
        await expect(redisCache.get('foo', {parse:false})).resolves.toEqual('\"bar\"');
      });
    
      it('should return null when the key is invalid', async () => {
        await expect(redisCache.get('invalidKey')).resolves.toEqual(null);
      });
    
      it('should return an error if there is an error acquiring a connection', async () => {
        await redisCache.store.getClient().disconnect();
        await expect(redisCache.get('foo')).rejects.toThrowError('The client is closed');
      });
    });
    
    describe('del', () => {
      it('should return a promise', async () => {
        expect(redisCache.del('foo')).toBeInstanceOf(Promise);
      });
    
      it('should delete a value for a given key', async () => {
        await redisCache.set('foo', 'bar');
        await expect(redisCache.get('foo')).resolves.toEqual('bar');
        await redisCache.del('foo');
        await expect(redisCache.get('foo')).resolves.toEqual(null);
      });
    
      it('should delete a value for a given key if options provided', async () => {
        await redisCache.set('foo', 'bar');
        await expect(redisCache.get('foo')).resolves.toEqual('bar');
        await redisCache.del('foo');
        await expect(redisCache.get('foo')).resolves.toEqual(null);
      });
    
      it('should return an error if there is an error acquiring a connection', async () => {
        await redisCache.store.getClient().disconnect();
        await expect(redisCache.del('foo')).rejects.toThrowError('The client is closed');
      });
    });
    
    describe('mset', () => {
      it('should return a promise', () => {
        expect(redisCache.mset('foo', 'bar')).toBeInstanceOf(Promise);
      });
    
      it('should store a value without ttl', async () => {
        await expect(redisCache.mset('foo', 'bar', 'foo2', 'bar2')).resolves.toEqual(["OK", "OK"]);
        await expect(redisCache.mget('foo', 'foo2')).resolves.toEqual(['bar', 'bar2']);
      });
    
      it('should store a value with a specific ttl', async () => {
        await redisCache.mset('foo', 'bar', 'foo2', 'bar2', {ttl: 60});
        await expect(redisCache.ttl('foo')).resolves.toEqual(60);
        await expect(redisCache.ttl('foo2')).resolves.toEqual(60);
      });
    
      it('should store a value with a infinite ttl', async () => {
        await redisCache.mset('foo', 'bar', {ttl: 0});
        await expect(redisCache.ttl('foo')).resolves.toEqual(-1);
      });
    
      it('should not be able to store a null value (not cacheable)', async () => {
        await expect(redisCache.mset('foo2', null)).rejects.toThrowError('"null" is not a cacheable value');
      });
    
      it('should store a value without callback', async () => {
        await expect(redisCache.mset('foo', 'baz', 'foo2', 'baz2')).resolves.toEqual(["OK", "OK"]);
        await expect(redisCache.mget('foo', 'foo2')).resolves.toEqual(['baz', 'baz2']);
      });
    
      it('should not store an invalid value', async () => {
        await expect(redisCache.mset('foo1', undefined)).rejects.toThrowError('"undefined" is not a cacheable value');
      });
    
      it('should store an undefined value if permitted by isCacheableValue', async () => {
        expect(customRedisCache.store.isCacheableValue(undefined)).toBe(true);
        await customRedisCache.mset('foo3', undefined, 'foo4', undefined);
        await expect(customRedisCache.mget('foo3', 'foo4')).resolves.toEqual(['undefined', 'undefined']);
      });
    
      it('should not store a value disallowed by isCacheableValue', async () => {
        expect(customRedisCache.store.isCacheableValue('FooBarString')).toBe(false);
        await expect(customRedisCache.mset('foobar', 'FooBarString')).rejects.toThrowError('"FooBarString" is not a cacheable value');
      });
    
      it('should return an error if there is an error acquiring a connection', async () => {
        await redisCache.store.getClient().disconnect();
        /**
         * Waiting for a pull request to be merged in order to uncomment the following assertion. The multi.exec() is
         * currently not rejecting the promise on client disconnect.
         *
         * @see https://github.com/redis/node-redis/pull/2293
         */
        // await expect(redisCache.mset('foo', 'bar')).rejects.toThrowError('The client is closed');
      });
    });
    
    describe('mget', () => {
      it('should return a promise', () => {
        expect(redisCache.mget('foo', 'foo2')).toBeInstanceOf(Promise);
      });
    
      it('should retrieve a value for a given key', async () => {
        const value = 'bar';
        const value2 = 'bar2';
        await redisCache.mset('foo', value, 'foo2', value2);
        await expect(redisCache.mget('foo', 'foo2')).resolves.toEqual([value, value2]);
      });
    
      it('should retrieve a value for a given key if options provided', async () => {
        const value = 'bar';
        await redisCache.mset('foo', value);
        await expect(redisCache.mget('foo', {someConfig: true})).resolves.toEqual([value]);
      });
    
      it('should retrieve a value for a given key unparsed', async () => {
        const value = 'bar';
        await redisCache.mset('foo', value);
        await expect(redisCache.mget('foo', {parse: false})).resolves.toEqual(['\"bar\"']);
      });
    
      it('should return null when the key is invalid', async () => {
        await expect(redisCache.mget('invalidKey', 'otherInvalidKey')).resolves.toEqual([null, null]);
      });
    
      it('should return an error if there is an error acquiring a connection', async () => {
        await redisCache.store.getClient().disconnect();
        await expect(redisCache.mget('foo')).rejects.toThrowError('The client is closed');
      });
    });
    
    
    describe('mdel', () => {
      it('should return a promise', async () => {
        expect(redisCache.store.mdel('foo', 'bar')).toBeInstanceOf(Promise);
      });

      it('should delete a unlimited number of keys', async () => {
        await redisCache.mset('foo', 'bar', 'foo2', 'bar2');
        await expect(redisCache.mget('foo', 'foo2')).resolves.toEqual(['bar', 'bar2']);
        await redisCache.store.mdel('foo', 'foo2');
        await expect(redisCache.mget('foo', 'foo2')).resolves.toEqual([null, null]);
      });
    
      it('should delete a unlimited number of keys if options provided', async () => {
        await redisCache.mset('foo', 'bar', 'foo2', 'bar2');
        await expect(redisCache.mget('foo', 'foo2')).resolves.toEqual(['bar', 'bar2']);
        await redisCache.store.mdel('foo', 'foo2', {});
        await expect(redisCache.mget('foo', 'foo2')).resolves.toEqual([null, null]);
      });
    
      it('should delete an array of keys', async () => {
        await redisCache.mset('foo', 'bar', 'foo2', 'bar2');
        await expect(redisCache.mget('foo', 'foo2')).resolves.toEqual(['bar', 'bar2']);
        await redisCache.store.mdel(['foo', 'foo2']);
        await expect(redisCache.mget('foo', 'foo2')).resolves.toEqual([null, null]);
      });
    
      it('should delete an array of keys if options provided', async () => {
        await redisCache.mset('foo', 'bar', 'foo2', 'bar2');
        await expect(redisCache.mget('foo', 'foo2')).resolves.toEqual(['bar', 'bar2']);
        await redisCache.store.mdel(['foo', 'foo2'], {});
        await expect(redisCache.mget('foo', 'foo2')).resolves.toEqual([null, null]);
      });
    
      it('should return an error if there is an error acquiring a connection', async () => {
        await redisCache.store.getClient().disconnect();
        await expect(redisCache.store.mdel('foo')).rejects.toThrowError('The client is closed');
      });
    });
    
    describe('reset', () => {
      it('should return a promise', async () => {
        expect(redisCache.reset()).toBeInstanceOf(Promise);
      });
    
      it('should flush underlying db', async () => {
        await redisCache.set('foo', 'bar');
        await redisCache.set('baz', 'qux');
        await redisCache.reset();
        await expect(redisCache.mget('foo', 'baz')).resolves.toEqual([null, null]);
      });
    
      it('should return an error if there is an error acquiring a connection', async () => {
        await redisCache.store.getClient().disconnect();
        await expect(redisCache.reset()).rejects.toThrowError('The client is closed');
      });
    });
    
    describe('keys', () => {
      it('should return a promise', async () => {
        expect(redisCache.keys('foo')).toBeInstanceOf(Promise);
      });
    
      it('should return an array of keys for the given pattern', async () => {
        await redisCache.set('foo', 'bar');
        await expect(redisCache.keys('foo')).resolves.toContainEqual('foo');
      });
    
      it('should return an array of all keys if called without a pattern', async () => {
        await redisCache.mset('foo', 'bar', 'foo2', 'bar2', 'foo3', 'bar3');
        await expect(redisCache.keys()).resolves.toHaveLength(3);
        await expect(redisCache.keys()).resolves.toEqual(expect.arrayContaining(['foo', 'foo2', 'foo3']));
      });
    
      it('should return an error if there is an error acquiring a connection', async () => {
        await redisCache.store.getClient().disconnect();
        await expect(redisCache.keys('foo')).rejects.toThrowError('The client is closed');
      });
    });
    
    describe('ttl', () => {
      it('should return a promise', async () => {
        expect(redisCache.ttl('foo')).toBeInstanceOf(Promise);
      });
    
      it('should retrieve ttl for a given key', async () => {
        await redisCache.set('foo', 'bar');
        await expect(redisCache.ttl('foo')).resolves.toEqual(config.ttl);
      });
    
      it('should retrieve ttl for an invalid key', async () => {
        await expect(redisCache.ttl('invalidKey')).resolves.toEqual(-2);
      });
    
      it('should return an error if there is an error acquiring a connection', async () => {
        await redisCache.set('foo', 'bar');
        await redisCache.store.getClient().disconnect();
        await expect(redisCache.ttl('foo')).rejects.toThrowError('The client is closed');
      });
    });
    
    describe('isCacheableValue', () => {
      it('should return true when the value is not undefined', () => {
        expect(redisCache.store.isCacheableValue(0)).toBe(true);
        expect(redisCache.store.isCacheableValue(100)).toBe(true);
        expect(redisCache.store.isCacheableValue('')).toBe(true);
        expect(redisCache.store.isCacheableValue('test')).toBe(true);
      });
    
      it('should return false when the value is undefined', () => {
        expect(redisCache.store.isCacheableValue(undefined)).toBe(false);
      });
    
      it('should return false when the value is null', () => {
        expect(redisCache.store.isCacheableValue(null)).toBe(false);
      });
    });
    
    describe('redis error event', () => {
      it('should return an error when the redis server is unavailable', (done) => {
        redisCache.store.getClient().on('error', (err) => {
          expect(err).not.toEqual(null);
          done();
        });
        redisCache.store.getClient().emit('error', 'Something unexpected');
      });
    });
    
    describe('overridable isCacheableValue function', () => {
      let redisCache2;
    
      beforeEach(async () => {
        redisCache2 = cacheManager.caching({
          store: await redisStore({
            ...config,
            isCacheableValue: () => {
              return 'I was overridden';
            }
          }),
          password: config.password
        });
      });
    
      it('should return its return value instead of the built-in function', () => {
        expect(redisCache2.store.isCacheableValue(0)).toEqual('I was overridden');
      });
    });
});

describe('redisClusterStore initialization', () => {
    let redisCache;
    let customRedisCache;
    
    const config = {
      rootNodes: [{
          url: 'redis://127.0.0.1:6379',
      }],
      password: undefined,
      db: 0,
      ttl: 5,
      useReplicas: true
    };
    
    beforeEach(async () => {
      redisCache = cacheManager.caching({
        store: await redisClusterStore(config),
      });
    
      const customConfig = {
        ...config,
        isCacheableValue: (val) => {
          if (val === undefined) { // allow undefined
            return true;
          } else if (val === 'FooBarString') { // disallow FooBarString
            return false;
          }
          return redisCache.store.isCacheableValue(val);
        }
      };
    
      customRedisCache = cacheManager.caching({
        store: await redisClusterStore(customConfig),
      });
    });
    
    describe('initialization', () => {
      it('should create a store with the options that were provided', async () => {
        const redisPwdCache = cacheManager.caching({
          store: await redisClusterStore(config),
          ...config
        });

        const options  = redisPwdCache.store.getClient()

        expect(redisPwdCache).toBeDefined();
      });
    });
    
    describe('set', () => {
      it('should return a promise', () => {
        expect(redisCache.set('foo', 'bar')).toBeInstanceOf(Promise);
      });
    
      it('should store a value without ttl', async () => {
        await redisCache.set('foo', 'bar');
        await expect(redisCache.get('foo')).resolves.toEqual('bar');
        await expect(redisCache.ttl('foo')).resolves.toEqual(config.ttl);
      });
    
      it('should store a value with a specific ttl', async () => {
        await redisCache.set('foo', 'bar', {ttl: 5});
        await expect(redisCache.ttl('foo')).resolves.toEqual(5);
      });
    
      it('should store a value with a infinite ttl', async () => {
        await redisCache.set('foo', 'bar', {ttl: 0});
        await expect(redisCache.ttl('foo')).resolves.toEqual(-1);
      });
    
      it('should not be able to store a null value (not cacheable)', async () => {
        await expect(redisCache.set('foo', null)).rejects.toThrowError('"null" is not a cacheable value');
      });
    
      it('should not store an invalid value', async () => {
        await expect(redisCache.set('foo1', undefined)).rejects.toThrowError('"undefined" is not a cacheable value');
      });
    
      it('should store an undefined value if permitted by isCacheableValue', async () => {
        expect(customRedisCache.store.isCacheableValue(undefined)).toBe(true);
        await customRedisCache.set('foo3', undefined);
      });
    
      it('should not store a value disallowed by isCacheableValue', async () => {
        expect(customRedisCache.store.isCacheableValue('FooBarString')).toBe(false);
        await expect(customRedisCache.set('foobar', 'FooBarString')).rejects.toThrowError('"FooBarString" is not a cacheable value');
      });
    
      it('should return an error if there is an error acquiring a connection', async () => {
        await redisCache.store.getClient().disconnect();
        await expect(redisCache.set('foo', 'bar')).rejects.toBeDefined();
      });
    });
    
    describe('get', () => {
      it('should return a promise', async () => {
        expect(redisCache.get('foo')).toBeInstanceOf(Promise);
      });

      it('should retrieve a value for a given key', async () => {
        const value = 'bar';
        await redisCache.set('foo', value);
        await expect(redisCache.get('foo')).resolves.toEqual(value);
      });
    
      it('should retrieve a value for a given key if options provided', async () => {
        const value = 'bar';
        await redisCache.set('foo', value);
        await expect(redisCache.get('foo', {})).resolves.toEqual(value);
      });
    
      it('should retrieve a value for a given key unparsed', async () => {
        const value = 'bar';
        await redisCache.set('foo', value);
        await expect(redisCache.get('foo', {parse:false})).resolves.toEqual('\"bar\"');
      });
    
      it('should return null when the key is invalid', async () => {
        await expect(redisCache.get('invalidKey')).resolves.toEqual(null);
      });
    
      it('should return an error if there is an error acquiring a connection', async () => {
        await redisCache.store.getClient().disconnect();
        await expect(redisCache.get('foo')).rejects.toThrowError();
      });
    });
    
    describe('del', () => {
      it('should return a promise', async () => {
        expect(redisCache.del('foo')).toBeInstanceOf(Promise);
      });
    
      it('should delete a value for a given key', async () => {
        await redisCache.set('foo', 'bar');
        await expect(redisCache.get('foo')).resolves.toEqual('bar');
        await redisCache.del('foo');
        await expect(redisCache.get('foo')).resolves.toEqual(null);
      });
    
      it('should delete a value for a given key if options provided', async () => {
        await redisCache.set('foo', 'bar');
        await expect(redisCache.get('foo')).resolves.toEqual('bar');
        await redisCache.del('foo', {});
        await expect(redisCache.get('foo')).resolves.toEqual(null);
      });
    
      it('should return an error if there is an error acquiring a connection', async () => {
        await redisCache.store.getClient().disconnect();
        await expect(redisCache.del('foo')).rejects.toThrowError();
      });
    });
    
    describe('mset', () => {
      it('should return a promise', () => {
        expect(redisCache.mset('foo', 'bar')).toBeInstanceOf(Promise);
      });
    
      it('should store a value without ttl', async () => {
        await expect(redisCache.mset('foo', 'bar')).resolves.toEqual(["OK"]);
        await expect(redisCache.mget('foo')).resolves.toEqual(['bar']);
      });
    
      it('should store a value with a specific ttl', async () => {
        await redisCache.mset('foo', 'bar', {ttl: 60});
        await expect(redisCache.ttl('foo')).resolves.toEqual(60);
      });
    
      it('should store a value with a infinite ttl', async () => {
        await redisCache.mset('foo', 'bar', {ttl: 0});
        await expect(redisCache.ttl('foo')).resolves.toEqual(-1);
      });
    
      it('should not be able to store a null value (not cacheable)', async () => {
        await expect(redisCache.mset('foo2', null)).rejects.toThrowError('"null" is not a cacheable value');
      });
    
      it('should store a value without callback', async () => {
        await expect(redisCache.mset('foo', 'baz')).resolves.toEqual(["OK"]);
        await expect(redisCache.mget('foo')).resolves.toEqual(['baz']);
      });
    
      it('should not store an invalid value', async () => {
        await expect(redisCache.mset('foo1', undefined)).rejects.toThrowError('"undefined" is not a cacheable value');
      });
    
      it('should store an undefined value if permitted by isCacheableValue', async () => {
        expect(customRedisCache.store.isCacheableValue(undefined)).toBe(true);
        await customRedisCache.mset('foo3', undefined);
        await expect(customRedisCache.mget('foo3')).resolves.toEqual(['undefined']);
      });
    
      it('should not store a value disallowed by isCacheableValue', async () => {
        expect(customRedisCache.store.isCacheableValue('FooBarString')).toBe(false);
        await expect(customRedisCache.mset('foobar', 'FooBarString')).rejects.toThrowError('"FooBarString" is not a cacheable value');
      });
    
      it('should return an error if there is an error acquiring a connection', async () => {
        await redisCache.store.getClient().disconnect();
        /**
         * Waiting for a pull request to be merged in order to uncomment the following assertion. The multi.exec() is
         * currently not rejecting the promise on client disconnect.
         *
         * @see https://github.com/redis/node-redis/pull/2293
         */
        // await expect(redisCache.mset('foo', 'bar')).rejects.toThrowError('The client is closed');
      });
    });
    
    describe('mget', () => {
      it('should return a promise', async () => {
        const possiblePromise = redisCache.mget('foo')
        expect(possiblePromise).toBeInstanceOf(Promise);
        await possiblePromise
      });
    
      it('should retrieve a value for a given key', async () => {
        const value = 'bar';
        const key = 'foo' + Math.random().toString()
        const x  = await redisCache.set(key, value);
        await expect(redisCache.mget(key, {})).resolves.toEqual([value]);
      });
    
      it('should retrieve a value for a given key if options provided', async () => {
        const value = 'bar';
        await redisCache.mset('foo', value);
        await expect(redisCache.mget('foo', {someConfig: true})).resolves.toEqual([value]);
      });
    
      it('should retrieve a value for a given key unparsed', async () => {
        const value = 'bar';
        await redisCache.mset('foo', value);
        await expect(redisCache.mget('foo', {parse: false})).resolves.toEqual(['\"bar\"']);
      });
    
      it('should return null when the key is invalid', async () => {
        await expect(redisCache.mget('invalidKey')).resolves.toEqual([null]);
      });
    
      it('should return an error if there is an error acquiring a connection', async () => {
        await expect(redisCache.mget('foo')).resolves.toBeDefined()
        await redisCache.store.getClient().disconnect();
        await expect(redisCache.mget('foo')).rejects.toThrowError();
      });
    });
    
    
    describe('mdel', () => {
      it('should return a promise', async () => {
        const possiblePromise = redisCache.store.mdel('foo')
        expect(possiblePromise).toBeInstanceOf(Promise);
        await possiblePromise
      });

    
      it('should delete a unlimited number of keys', async () => {
        await redisCache.mset('foo', 'bar');
        await expect(redisCache.mget('foo')).resolves.toEqual(['bar']);
        await redisCache.store.mdel('foo');
        await expect(redisCache.mget('foo')).resolves.toEqual([null]);
      });
    
      it('should delete a unlimited number of keys if options provided', async () => {
        await redisCache.mset('foo', 'bar');
        await expect(redisCache.mget('foo')).resolves.toEqual(['bar']);
        await redisCache.store.mdel('foo', {});
        await expect(redisCache.mget('foo')).resolves.toEqual([null, ]);
      });

      it('should delete an array of keys if options provided', async () => {
        await redisCache.mset('foo', 'bar');
        await expect(redisCache.mget('foo')).resolves.toEqual(['bar']);
        await redisCache.store.mdel(['foo'], {});
        await expect(redisCache.mget('foo')).resolves.toEqual([null]);
      });
    
      it('should return an error if there is an error acquiring a connection', async () => {
        await redisCache.mset('foo', 'bar');
        await expect(redisCache.store.mdel('foo')).resolves.toBeDefined();
        await redisCache.store.getClient().disconnect();
        await expect(redisCache.store.mdel('foo')).rejects.toThrowError();
      });
    });
    
    describe('reset', () => {
      it('should return a promise', async () => {
        await expect(redisCache.reset()).rejects.toBe('Cannot Reset');
      });
    });
    
    describe('keys', () => {
      it('should return a promise', async () => {
        await expect(redisCache.keys('foo')).rejects.toBe('Has No Keys Function');
      });
    });
    
    describe('ttl', () => {
      it('should return a promise', async () => {
        expect(redisCache.ttl('foo')).toBeInstanceOf(Promise);
      });

      it('should retrieve ttl for a given key', async () => {
        await redisCache.set('foo', 'bar');
        await expect(redisCache.ttl('foo')).resolves.toEqual(config.ttl);
      });
    
      it('should retrieve ttl for an invalid key', async () => {
        await expect(redisCache.ttl('invalidKey')).resolves.toEqual(-2);
      });
    
      it('should return an error if there is an error acquiring a connection', async () => {
        await redisCache.set('foo', 'bar');
        await redisCache.store.getClient().disconnect();
        await expect(redisCache.ttl('foo')).rejects.toThrowError();
      });
    });
    
    describe('isCacheableValue', () => {
      it('should return true when the value is not undefined', () => {
        expect(redisCache.store.isCacheableValue(0)).toBe(true);
        expect(redisCache.store.isCacheableValue(100)).toBe(true);
        expect(redisCache.store.isCacheableValue('')).toBe(true);
        expect(redisCache.store.isCacheableValue('test')).toBe(true);
      });
    
      it('should return false when the value is undefined', () => {
        expect(redisCache.store.isCacheableValue(undefined)).toBe(false);
      });
    
      it('should return false when the value is null', () => {
        expect(redisCache.store.isCacheableValue(null)).toBe(false);
      });
    });
    
    describe('redis error event', () => {
      it('should return an error when the redis server is unavailable', (done) => {
        redisCache.store.getClient().on('error', (err) => {
          expect(err).not.toEqual(null);
          done();
        });
        redisCache.store.getClient().emit('error', 'Something unexpected');
      });
    });
    
    describe('overridable isCacheableValue function', () => {
      let redisCache2;
    
      beforeEach(async () => {
        redisCache2 = cacheManager.caching({
          store: await redisStore({
            ...config,
            isCacheableValue: () => {
              return 'I was overridden';
            }
          }),
          password: config.password
        });
      });
    
      it('should return its return value instead of the built-in function', () => {
        expect(redisCache2.store.isCacheableValue(0)).toEqual('I was overridden');
      });
    });
})
