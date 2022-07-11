/**
 * In the case of using Redis as client, the `set` command
 * creates a key-value pair of string type in the ram. This
 * method might not be the most memory efficient, but it is
 * easy to manage the expiration time.
 *
 * By contrast, while complex data structurs like hashfields
 * or sets are structurally clean, expiration management can
 * be error proning. This is because Redis only allows for
 * top-level keys to be expired, and not child keys. (Source:
 * https://redis.io/commands/expire/)
 *
 * Child key expirations have to be cleverly engineered to
 * avoid leaving orphaned keys. The time required to create
 * such solutions and the potential risks involved are not
 * worth the marginal memory efficiency added.
 *
 * WARNING: Regardless of the data structure used, same error
 * messages are expected to be hashed to the same key. However,
 * error messages can contain nondeterministic values. For
 * example, the error message `err: returned 404 in 15ms` will
 * be hashed to a different key than `err: returned 404 in 6ms`.
 *
 */

import { logger } from './utils'

interface Client {
  exists: (key: string) => Promise<number>
  // In the case of Redis, the return can be string | null
  // See: https://redis.io/commands/set/#return
  // Set the Promise to return any to ensures generality.
  set: (key: string, value: any, options: object) => Promise<any>
}
const EXPIRATION_TIME_IN_SECONDS = 60 * 5 // 5 mins
const DEFAULT_VALUE = 0

/**
 * Returns a function.
 *
 * The returned function can be called with a `message`
 * argument, and it executes the `callback` function if the
 * `message` does not already exist in `client`. Otherwise,
 * it does nothing.
 * @param client     - An object that can set a message, and
 *                     check if a message exists. It can be
 *                     a Redis client or any other types of
 *                     client.
 * @param callback   - A function to execute if the message
 *                     does not exist in the client
 * @param expiration - The number of seconds before the message
 *                     expires from the client.
 *                     Defaults to 5 mins.
 * @returns A function that takes a message as an argument.
 */
export const createThrottledMessage = (
  client: Client,
  callback: (message: string) => Promise<void>,
  expiration: number = EXPIRATION_TIME_IN_SECONDS
) => async (message: string): Promise<void> => {
  try {
    const messageExists = await client.exists(message)
    if (messageExists === 0) {
      await client.set(message, DEFAULT_VALUE, { EX: expiration })
      await callback(message)
    }
  } catch (e) {
    logger(`Error setting a message or executing a callback: ${e}`)
  }
}
