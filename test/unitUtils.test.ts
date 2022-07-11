import { assert } from 'chai'
import { describe, it } from 'mocha'

import { asExchangeRateReq } from '../src/exchangeRateRouter'
import { createThrottledMessage } from '../src/utils/createThrottledMessage'
import { normalizeDate } from '../src/utils/utils'
import fixtures from './unitUtils.json'

for (const test of fixtures.normalizeDate) {
  const { input, output } = test

  describe(`normalizeDate`, function() {
    it(`testing input ${input}`, function() {
      assert.equal(normalizeDate(input), output)
    })
  })
}

var globalTime = 0
const ram = {
  // "errorMessage": [value, expirationTimeInSeconds]
}
const client = {
  set: async (key, value, options) => {
    ram[key] = [value, options.EX]
    return Promise.resolve()
  },
  exists: async (key: string) => {
    var keyExists = Object.prototype.hasOwnProperty.call(ram, key)
    if (keyExists && ram[key][1] < globalTime) {
      delete ram[key]
      keyExists = false
    }
    return Promise.resolve(keyExists ? 1 : 0)
  }
}

const messageQueue: string[] = []
const callback = async (message: string): Promise<void> => {
  await messageQueue.push(message)
}

for (const message of fixtures.errorMessages) {
  const { input, output } = message
  const processMessage = createThrottledMessage(client, callback)

  describe(`errorMessages`, function() {
    it(`testing input: ${input}`, async function() {
      await processMessage(input)
      // T-0
      assert.equal(messageQueue[messageQueue.length - 1], output) // successfully added to queue for each iteration
      assert.equal(ram[input][0], 0)
      assert.equal(ram[input][1], 300)
      globalTime += 240

      // T-4
      assert.equal(Object.prototype.hasOwnProperty.call(ram, input), true) // key still exists before expiration

      // try to send the same message again before expiration
      const messageQueueLength = messageQueue.length
      await processMessage(input)
      assert.equal(messageQueue.length, messageQueueLength) // message should not be added to queue
      globalTime += 120

      // T-6
      const keyExists = await client.exists(input)
      assert.equal(keyExists, 0) // message is deleted

      globalTime = 0 // reset global time for next loop
    })
  })
}

for (const test of fixtures.asRateParam) {
  const { input, output } = test

  describe(`asRateParam`, function() {
    it(`testing input ${JSON.stringify(input)}`, function() {
      let result
      try {
        result = asExchangeRateReq(input)
      } catch (e) {
        if (e instanceof Error) result = e.message
        else result = String(e)
      }
      if (typeof result !== 'string' && input.date == null) {
        result.date = 'variableDate'
      }
      assert.deepEqual(result, output)
    })
  })
}
