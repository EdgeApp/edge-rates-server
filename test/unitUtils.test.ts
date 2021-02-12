import { assert } from 'chai'
import { describe, it } from 'mocha'

import { asRateParam } from '../src/types'
import { normalizeDate } from '../src/utils'
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
    it(`testing input ${input}`, function() {
      let result
      try {
        result = asRateParam(input)
      } catch (e) {
        result = e.message
      }
      if (typeof result !== 'string' && input.date == null) {
        result.date = 'variableDate'
      }
      assert.deepEqual(result, output)
    })
  })
}
