import { assert } from 'chai'
import { describe, it } from 'mocha'

import { asExchangeRateReq } from '../src/exchangeRateRouter'
import { createThrottledMessage } from '../src/utils/createThrottledMessage'
import { getDelay, normalizeDate } from '../src/utils/utils'
import fixtures from './unitUtils.json'

for (const test of fixtures.normalizeDate) {
  const { input, output } = test

  describe(`normalizeDate`, function () {
    it(`testing input ${input}`, function () {
      assert.equal(normalizeDate(input), output)
    })
  })
}

let globalTime = 0
const ram = {
  // "errorMessage": [value, expirationTimeInSeconds]
}
const client = {
  set: async (key, value, options) => {
    ram[key] = [value, options.EX]
    return await Promise.resolve()
  },
  exists: async (key: string) => {
    let keyExists = Object.prototype.hasOwnProperty.call(ram, key)
    if (keyExists && ram[key][1] < globalTime) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete ram[key]
      keyExists = false
    }
    return await Promise.resolve(keyExists ? 1 : 0)
  }
}

const messageQueue: string[] = []
const callback = async (message: string): Promise<void> => {
  await messageQueue.push(message)
}

for (const message of fixtures.errorMessages) {
  const { input, output } = message
  const processMessage = createThrottledMessage(client, callback)

  describe(`errorMessages`, function () {
    it(`testing input: ${input}`, async function () {
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

  describe(`asRateParam`, function () {
    it(`testing input ${JSON.stringify(input)}`, function () {
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

describe(`getDelay tests`, function () {
  it(`getDelay 1:30 0 15`, function () {
    assert.equal(
      getDelay({
        now: new Date('2024-01-10T00:01:30.000Z'),
        offsetSeconds: 0,
        intervalSeconds: 15
      }),
      15000
    )
  })
  it(`getDelay 1:35.100 0 15`, function () {
    assert.equal(
      getDelay({
        now: new Date('2024-01-10T00:01:35.100Z'),
        offsetSeconds: 0,
        intervalSeconds: 15
      }),
      9900
    )
  })
  it(`getDelay 1:29.999 0 120`, function () {
    assert.equal(
      getDelay({
        now: new Date('2024-01-10T00:01:29.999Z'),
        offsetSeconds: 0,
        intervalSeconds: 120
      }),
      30001
    )
  })
  it(`getDelay 1:29.999 60 120`, function () {
    assert.equal(
      getDelay({
        now: new Date('2024-01-10T00:01:29.999Z'),
        offsetSeconds: 60,
        intervalSeconds: 120
      }),
      90001
    )
  })
  it(`getDelay 51:30 0 120`, function () {
    assert.equal(
      getDelay({
        now: new Date('2024-01-10T00:51:30.000Z'),
        offsetSeconds: 0,
        intervalSeconds: 120
      }),
      30000
    )
  })
  it(`getDelay 51:29.999 0 120`, function () {
    assert.equal(
      getDelay({
        now: new Date('2024-01-10T00:51:29.999Z'),
        offsetSeconds: 0,
        intervalSeconds: 120
      }),
      30001
    )
  })
  it(`getDelay 51:29.999 60 120`, function () {
    assert.equal(
      getDelay({
        now: new Date('2024-01-10T00:51:29.999Z'),
        offsetSeconds: 60,
        intervalSeconds: 120
      }),
      90001
    )
  })

  it(`getDelay 1:30 0 180`, function () {
    assert.equal(
      getDelay({
        now: new Date('2024-01-10T00:01:30.000Z'),
        offsetSeconds: 0,
        intervalSeconds: 180
      }),
      90000
    )
  })
  it(`getDelay 1:29.999 0 180`, function () {
    assert.equal(
      getDelay({
        now: new Date('2024-01-10T00:01:29.999Z'),
        offsetSeconds: 0,
        intervalSeconds: 180
      }),
      90001
    )
  })

  it(`getDelay 51:29.999 60 180`, function () {
    assert.equal(
      getDelay({
        now: new Date('2024-01-10T00:51:29.999Z'),
        offsetSeconds: 60,
        intervalSeconds: 180
      }),
      30001
    )
  })
  it(`getDelay 58:29.999 60 180`, function () {
    assert.equal(
      getDelay({
        now: new Date('2024-01-10T00:58:29.999Z'),
        offsetSeconds: 60,
        intervalSeconds: 180
      }),
      150001
    )
  })

  it(`getDelay 58:29.999 0 30`, function () {
    assert.equal(
      getDelay({
        now: new Date('2024-01-10T00:58:29.999Z'),
        offsetSeconds: 0,
        intervalSeconds: 30
      }),
      1
    )
  })
  it(`getDelay 55:59.999 0 30`, function () {
    assert.equal(
      getDelay({
        now: new Date('2024-01-10T00:55:59.999Z'),
        offsetSeconds: 0,
        intervalSeconds: 30
      }),
      1
    )
  })
  it(`getDelay 59:59.999 0 30`, function () {
    assert.equal(
      getDelay({
        now: new Date('2024-01-10T00:59:59.999Z'),
        offsetSeconds: 0,
        intervalSeconds: 30
      }),
      1
    )
  })
  it(`getDelay 59:59.999 30 60`, function () {
    assert.equal(
      getDelay({
        now: new Date('2024-01-10T00:59:59.999Z'),
        offsetSeconds: 30,
        intervalSeconds: 60
      }),
      30001
    )
  })
  it(`getDelay 59:59.999 0 60`, function () {
    assert.equal(
      getDelay({
        now: new Date('2024-01-10T00:59:59.999Z'),
        offsetSeconds: 0,
        intervalSeconds: 60
      }),
      1
    )
  })
  it(`getDelay 58:09.999 30 60`, function () {
    assert.equal(
      getDelay({
        now: new Date('2024-01-10T00:58:09.999Z'),
        offsetSeconds: 30,
        intervalSeconds: 60
      }),
      20001
    )
  })
  it(`getDelay 58:09.999 0 60`, function () {
    assert.equal(
      getDelay({
        now: new Date('2024-01-10T00:58:09.999Z'),
        offsetSeconds: 0,
        intervalSeconds: 60
      }),
      50001
    )
  })
})
