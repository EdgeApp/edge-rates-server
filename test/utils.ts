import { assert } from 'chai'
import { describe, it } from 'mocha'

import { asRateParams } from '../src/types'
import { curry, normalizeDate } from '../src/utils'
import fixtures from './utils.json'

describe(`normalizeDate`, function() {
  for (const test of fixtures.normalizeDate) {
    const [input, output] = test
    it(`testing input ${input}`, function() {
      assert.equal(normalizeDate(input), output)
    })
  }
})

describe(`asRateParams`, function() {
  for (const test of Object.keys(fixtures.asRateParams)) {
    const [input, output] = fixtures.asRateParams[test]
    it(test, function() {
      let result
      try {
        result = asRateParams(input)
      } catch (e) {
        result = e.message
      }
      if (typeof result !== 'string' && input.date == null) {
        result.date = 'variableDate'
      }
      assert.deepEqual(result, output)
    })
  }
})

describe('curry', function() {
  const func = (x: number, y: number, z: number): number => x + y + z
  const carriedFunc = curry(func)
  for (const test in fixtures.curry) {
    const [input, output] = fixtures.curry[test]
    it(test, function() {
      let res = carriedFunc
      for (let i = 0; i < input.length; i++) {
        if (Array.isArray(input[i])) res = res(...input[i])
        else res = res(input[i])
      }
      assert.equal(res, output)
    })
  }
})
