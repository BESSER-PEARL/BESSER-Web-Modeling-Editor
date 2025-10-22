import { RedisClientType } from 'redis';
import { Operation } from 'fast-json-patch';

/**
 * Converts a [JSONPointer](https://tools.ietf.org/html/rfc6901) to a Redis JSON path.
 * JSONPointer is the standard format for addressing various parts of a JSON document used by
 * [JSONPatch](https://jsonpatch.com).
 * @param jsonPointer
 * @returns
 */
export function convertJSONPointerToRedisJSONPath(jsonPointer: string): string {
  return jsonPointer.replace(/\//g, '.').replace(/~1/g, '/').replace(/~0/g, '~');
}

/**
 * Applies a JSONPatch to a Redis JSON value.
 * @param client the Redis client to use
 * @param key the key of the Redis value
 * @param patch the JSONPatch to apply
 * @param prefix the prefix to use for the JSON path. Defaults to `'$'`, i.e. the root of the document. Add another prefix to apply the patch to a nested object. For example, if patches are to be applied to `model` field of an object, use `'$.model'`. The prefix should be in format of [redis JSON path](https://redis.io/docs/latest/develop/data-types/json/path/).
 */
export async function applyPatchToRedisValue(client: RedisClientType, key: string, patch: Operation[], prefix = '$') {
  for (const operation of patch) {
    const path = prefix + convertJSONPointerToRedisJSONPath(operation.path);

    try {
      switch (operation.op) {
        case 'add':
        case 'replace':
          await client.json.set(key, path, operation.value);
          break;
        case 'remove':
          await client.json.del(key, path);
          break;
        default:
          throw Error(`Unsupported operation ${operation.op}`);
      }
    } catch (err) {
      console.log(`Can't apply patch ${operation.op} to ${key}:: `, err);
      console.log('On Redis path: ' + path);
      console.log(err);
    }
  }
}
