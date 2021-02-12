import { assert } from 'chai'
import { describe, it } from 'mocha'

import { asCoinMarketCapHistoricalResponse } from '../../src/providers/coinMarketCap'
import fixtures from './fixtures.json'

for (const test in fixtures.asCoinMarketCapHistoricalResponse) {
  const [input, output] = fixtures.asCoinMarketCapHistoricalResponse[test]

  describe(`asCoinMarketCapHistoricalResponse`, function() {
    it(`${test}`, function() {
      if (output === true) {
        const response = asCoinMarketCapHistoricalResponse(input)
        console.log('14. response', response)
        // @ts-ignore: Unreachable code error
        assert.isNotEmpty(response)
      } else {
        // @ts-ignore: Unreachable code error
        assert.throws(asCoinMarketCapHistoricalResponse(input))
      }
    })
  })
}
