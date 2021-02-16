import { assert } from 'chai'
import { describe, it } from 'mocha'

import {
  asCoinMarketCapHistoricalData,
  asCoinMarketCapStatus
} from '../../src/providers/coinMarketCap'
import fixtures from './coinMaketCap.json'

for (const test in fixtures.asCoinMarketCapHistoricalResponse) {
  const [input, output] = fixtures.asCoinMarketCapHistoricalResponse[test]

  describe('asCoinMarketCapHistoricalResponse', function() {
    it(`${test}`, function() {
      if (output === true) {
        const { status } = asCoinMarketCapStatus(input)
        const { data } = asCoinMarketCapHistoricalData(input)

        assert.deepEqual(status, { notice: null, ...input.status })
        assert.isNotEmpty(data, input.data)
      } else {
        const { status } = asCoinMarketCapStatus(input)

        assert.deepEqual(status, { notice: null, ...input.status })
        assert.doesNotThrow(() => asCoinMarketCapStatus(input))
        assert.throw(() => asCoinMarketCapHistoricalData(input))
      }
    })
  })
}
