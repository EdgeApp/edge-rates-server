import { assert } from 'chai'
import { describe, it } from 'mocha'

import { asRateGetterParams } from '../../src/types/cleaners'
import { curry, mergeDocuments, normalizeDate } from '../../src/utils/utils'
import fixtures from './utils.json'

describe(`normalizeDate`, function() {
  for (const test of fixtures.normalizeDate) {
    const [input, output] = test
    it(`testing input ${input}`, function() {
      assert.equal(normalizeDate(input), output)
    })
  }
})

describe(`asRateGetterParams`, function() {
  for (const test of Object.keys(fixtures.asRateGetterParams)) {
    const [input, output] = fixtures.asRateGetterParams[test]
    it(test, function() {
      let result
      try {
        result = asRateGetterParams(input)
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
        // @ts-ignore
        if (Array.isArray(input[i])) res = res(...input[i])
        // @ts-ignore
        else res = res(input[i])
      }
      assert.equal(res, output)
    })
  }
})

describe('mergeDocuments', function() {
  const { documents } = fixtures.mergeDocuments
  for (const test of fixtures.mergeDocuments.tests) {
    const [input, output] = test
    it(`Testing Origin: ${input[1]}, into Destination: ${input[0]}`, function() {
      assert.deepEqual(
        mergeDocuments(documents[input[0]], documents[input[1]]),
        output
      )
    })
  }
})
