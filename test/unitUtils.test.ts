import { assert } from 'chai'
import { describe, it } from 'mocha'

import { asExchangeRateReq } from '../src/exchangeRateRouter'
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
