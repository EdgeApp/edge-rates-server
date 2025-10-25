import { assert } from 'chai'
import { describe, it } from 'mocha'

import currencyMapping from '../data/v2CurrencyCodeMap.json'
import type { GetRatesParams, V2CurrencyCodeMap } from '../src/v3/types'
import { convertV2, convertV3ToV2 } from '../src/v3/v2converter'

// Use the actual currency mapping file
const currencyCodeMap = currencyMapping as V2CurrencyCodeMap

describe('convertV2', () => {
  describe('crypto to fiat pairs', () => {
    it('should convert BTC_iso:USD to V3 format', () => {
      const v2Requests = [{ currency_pair: 'BTC_iso:USD' }]
      const result = convertV2(v2Requests, currencyCodeMap)

      assert.strictEqual(result.targetFiat, 'USD')
      assert.strictEqual(result.crypto.length, 1)
      assert.strictEqual(result.crypto[0].asset.pluginId, 'bitcoin')
      assert.strictEqual(result.crypto[0].asset.tokenId, null)
      assert.instanceOf(result.crypto[0].isoDate, Date) // Date is auto-filled
      assert.isUndefined(result.crypto[0].rate)
      assert.strictEqual(result.fiat.length, 0)
    })

    it('should convert BTC_iso:EUR to V3 format with EUR in fiat array', () => {
      const v2Requests = [{ currency_pair: 'BTC_iso:EUR' }]
      const result = convertV2(v2Requests, currencyCodeMap)

      assert.strictEqual(result.targetFiat, 'USD')
      assert.strictEqual(result.crypto.length, 1)
      assert.strictEqual(result.crypto[0].asset.pluginId, 'bitcoin')
      assert.instanceOf(result.crypto[0].isoDate, Date) // Date is auto-filled
      assert.strictEqual(result.fiat.length, 1)
      assert.strictEqual(result.fiat[0].fiatCode, 'EUR')
      assert.instanceOf(result.fiat[0].isoDate, Date) // Date is auto-filled
    })

    it('should convert multiple crypto to USD pairs', () => {
      const v2Requests = [
        { currency_pair: 'BTC_iso:USD' },
        { currency_pair: 'ETH_iso:USD' },
        { currency_pair: 'LTC_iso:USD' }
      ]
      const result = convertV2(v2Requests, currencyCodeMap)

      assert.strictEqual(result.targetFiat, 'USD')
      assert.strictEqual(result.crypto.length, 3)

      const pluginIds = result.crypto.map(c => c.asset.pluginId).sort()
      assert.deepStrictEqual(pluginIds, ['bitcoin', 'ethereum', 'litecoin'])
      assert.strictEqual(result.fiat.length, 0)
    })

    it('should convert token with tokenId', () => {
      const v2Requests = [{ currency_pair: 'USDT_iso:USD' }]
      const result = convertV2(v2Requests, currencyCodeMap)

      assert.strictEqual(result.crypto[0].asset.pluginId, 'ethereum')
      assert.strictEqual(
        result.crypto[0].asset.tokenId,
        'dac17f958d2ee523a2206206994597c13d831ec7'
      )
      assert.instanceOf(result.crypto[0].isoDate, Date) // Date is auto-filled
      assert.isUndefined(result.crypto[0].rate)
    })
  })

  describe('fiat to crypto pairs', () => {
    it('should convert iso:USD_ETH to V3 format', () => {
      const v2Requests = [{ currency_pair: 'iso:USD_ETH' }]
      const result = convertV2(v2Requests, currencyCodeMap)

      assert.strictEqual(result.targetFiat, 'USD')
      assert.strictEqual(result.crypto.length, 1)
      assert.strictEqual(result.crypto[0].asset.pluginId, 'ethereum')
      assert.strictEqual(result.crypto[0].asset.tokenId, null)
      assert.instanceOf(result.crypto[0].isoDate, Date) // Date is auto-filled
      assert.strictEqual(result.fiat.length, 0)
    })

    it('should convert iso:EUR_BTC to V3 format with EUR in fiat array', () => {
      const v2Requests = [{ currency_pair: 'iso:EUR_BTC' }]
      const result = convertV2(v2Requests, currencyCodeMap)

      assert.strictEqual(result.targetFiat, 'USD')
      assert.strictEqual(result.crypto.length, 1)
      assert.strictEqual(result.crypto[0].asset.pluginId, 'bitcoin')
      assert.instanceOf(result.crypto[0].isoDate, Date) // Date is auto-filled
      assert.strictEqual(result.fiat.length, 1)
      assert.strictEqual(result.fiat[0].fiatCode, 'EUR')
      assert.instanceOf(result.fiat[0].isoDate, Date) // Date is auto-filled
    })
  })

  describe('crypto to crypto pairs', () => {
    it('should convert BTC_ETH to V3 format', () => {
      const v2Requests = [{ currency_pair: 'BTC_ETH' }]
      const result = convertV2(v2Requests, currencyCodeMap)

      assert.strictEqual(result.targetFiat, 'USD')
      assert.strictEqual(result.crypto.length, 2)

      const pluginIds = result.crypto.map(c => c.asset.pluginId).sort()
      assert.deepStrictEqual(pluginIds, ['bitcoin', 'ethereum'])
      assert.strictEqual(result.fiat.length, 0)
    })

    it('should convert multiple crypto to crypto pairs', () => {
      const v2Requests = [
        { currency_pair: 'BTC_ETH' },
        { currency_pair: 'ETH_LTC' }
      ]
      const result = convertV2(v2Requests, currencyCodeMap)

      assert.strictEqual(result.crypto.length, 3)

      const pluginIds = result.crypto.map(c => c.asset.pluginId).sort()
      assert.deepStrictEqual(pluginIds, ['bitcoin', 'ethereum', 'litecoin'])
    })
  })

  describe('fiat to fiat pairs', () => {
    it('should convert iso:EUR_iso:USD to V3 format', () => {
      const v2Requests = [{ currency_pair: 'iso:EUR_iso:USD' }]
      const result = convertV2(v2Requests, currencyCodeMap)

      assert.strictEqual(result.targetFiat, 'USD')
      assert.strictEqual(result.crypto.length, 0)
      assert.strictEqual(result.fiat.length, 1)
      assert.strictEqual(result.fiat[0].fiatCode, 'EUR')
      assert.instanceOf(result.fiat[0].isoDate, Date) // Date is auto-filled
    })

    it('should convert iso:EUR_iso:GBP to V3 format', () => {
      const v2Requests = [{ currency_pair: 'iso:EUR_iso:GBP' }]
      const result = convertV2(v2Requests, currencyCodeMap)

      assert.strictEqual(result.targetFiat, 'USD')
      assert.strictEqual(result.crypto.length, 0)
      assert.strictEqual(result.fiat.length, 2)

      const fiatCodes = result.fiat.map(f => f.fiatCode).sort()
      assert.deepStrictEqual(fiatCodes, ['EUR', 'GBP'])
    })
  })

  describe('date handling', () => {
    it('should preserve date information', () => {
      const testDate = '2023-10-23T12:00:00.000Z'
      const v2Requests = [{ currency_pair: 'BTC_iso:USD', date: testDate }]
      const result = convertV2(v2Requests, currencyCodeMap)

      assert.deepStrictEqual(result.crypto[0].isoDate, new Date(testDate))
    })

    it('should handle different dates for different requests', () => {
      const date1 = '2023-10-23T12:00:00.000Z'
      const date2 = '2023-10-24T12:00:00.000Z'
      const v2Requests = [
        { currency_pair: 'BTC_iso:USD', date: date1 },
        { currency_pair: 'ETH_iso:USD', date: date2 }
      ]
      const result = convertV2(v2Requests, currencyCodeMap)

      assert.strictEqual(result.crypto.length, 2)
    })

    it('should NOT deduplicate same asset with different dates', () => {
      const date1 = '2023-10-23T12:00:00.000Z'
      const date2 = '2023-10-24T12:00:00.000Z'
      const v2Requests = [
        { currency_pair: 'BTC_iso:USD', date: date1 },
        { currency_pair: 'BTC_iso:USD', date: date2 }
      ]
      const result = convertV2(v2Requests, currencyCodeMap)

      // Should have 2 BTC entries - one for each date
      assert.strictEqual(result.crypto.length, 2)
      assert.strictEqual(result.crypto[0].asset.pluginId, 'bitcoin')
      assert.strictEqual(result.crypto[1].asset.pluginId, 'bitcoin')
      assert.strictEqual(result.crypto[0].isoDate?.toISOString(), date1)
      assert.strictEqual(result.crypto[1].isoDate?.toISOString(), date2)
    })
  })

  describe('mixed pairs', () => {
    it('should handle a mix of different pair types', () => {
      const v2Requests = [
        { currency_pair: 'BTC_iso:USD' },
        { currency_pair: 'ETH_iso:EUR' },
        { currency_pair: 'BTC_ETH' },
        { currency_pair: 'iso:GBP_iso:USD' }
      ]
      const result = convertV2(v2Requests, currencyCodeMap)

      assert.strictEqual(result.targetFiat, 'USD')
      assert.strictEqual(result.crypto.length, 2) // BTC and ETH (deduplicated)
      assert.strictEqual(result.fiat.length, 2) // EUR and GBP
    })
  })

  describe('deduplication', () => {
    it('should deduplicate repeated currency pairs', () => {
      const v2Requests = [
        { currency_pair: 'BTC_iso:USD' },
        { currency_pair: 'BTC_iso:USD' },
        { currency_pair: 'BTC_iso:USD' }
      ]
      const result = convertV2(v2Requests, currencyCodeMap)

      assert.strictEqual(result.crypto.length, 1)
      assert.strictEqual(result.crypto[0].asset.pluginId, 'bitcoin')
    })

    it('should deduplicate assets from different pair types', () => {
      const v2Requests = [
        { currency_pair: 'BTC_iso:USD' }, // BTC
        { currency_pair: 'BTC_ETH' }, // BTC and ETH
        { currency_pair: 'iso:USD_ETH' } // ETH
      ]
      const result = convertV2(v2Requests, currencyCodeMap)

      assert.strictEqual(result.crypto.length, 2) // BTC and ETH (deduplicated)
    })
  })

  describe('error handling', () => {
    it('should throw error for invalid currency pair format', () => {
      const v2Requests = [{ currency_pair: 'BTC' }]
      assert.throws(
        () => convertV2(v2Requests, currencyCodeMap),
        'Invalid currency pair format: BTC'
      )
    })

    it('should use fallback for unknown currency code', () => {
      const v2Requests = [{ currency_pair: 'UNKNOWN_iso:USD' }]
      const result = convertV2(v2Requests, currencyCodeMap)

      // Should use uppercase currency code as pluginId fallback
      assert.strictEqual(result.crypto.length, 1)
      assert.strictEqual(result.crypto[0].asset.pluginId, 'UNKNOWN')
      assert.strictEqual(result.crypto[0].asset.tokenId, null)
    })

    it('should throw error for currency pair with too many parts', () => {
      const v2Requests = [{ currency_pair: 'BTC_ETH_LTC' }]
      assert.throws(
        () => convertV2(v2Requests, currencyCodeMap),
        'Invalid currency pair format: BTC_ETH_LTC'
      )
    })
  })

  describe('edge cases', () => {
    it('should handle empty array', () => {
      const v2Requests: Array<{ currency_pair: string; date?: string }> = []
      const result = convertV2(v2Requests, currencyCodeMap)

      assert.strictEqual(result.targetFiat, 'USD')
      assert.strictEqual(result.crypto.length, 0)
      assert.strictEqual(result.fiat.length, 0)
    })

    it('should handle USD_USD pair', () => {
      const v2Requests = [{ currency_pair: 'iso:USD_iso:USD' }]
      const result = convertV2(v2Requests, currencyCodeMap)

      assert.strictEqual(result.targetFiat, 'USD')
      assert.strictEqual(result.crypto.length, 0)
      assert.strictEqual(result.fiat.length, 0)
    })

    it('should handle same token with different tokenIds', () => {
      const v2Requests = [
        { currency_pair: 'USDT_iso:USD' },
        { currency_pair: 'DAI_iso:USD' }
      ]
      const result = convertV2(v2Requests, currencyCodeMap)

      assert.strictEqual(result.crypto.length, 2)
      assert.notStrictEqual(
        result.crypto[0].asset.tokenId,
        result.crypto[1].asset.tokenId
      )
    })
  })
})

describe('convertV3ToV2', () => {
  const mockDate1 = new Date('2023-10-23T12:00:00.000Z')
  const mockDate2 = new Date('2023-10-24T12:00:00.000Z')

  describe('date matching', () => {
    it('should match crypto rates by date', () => {
      const v2Requests = [
        { currency_pair: 'BTC_iso:USD', date: mockDate1.toISOString() }
      ]
      const v3Response: GetRatesParams = {
        targetFiat: 'USD',
        crypto: [
          {
            asset: { pluginId: 'bitcoin', tokenId: null },
            isoDate: mockDate1,
            rate: 50000
          }
        ],
        fiat: []
      }

      const result = convertV3ToV2(v2Requests, v3Response, currencyCodeMap)

      assert.strictEqual(result.length, 1)
      assert.strictEqual(result[0].exchangeRate, '50000')
      assert.isUndefined(result[0].error)
    })

    it('should match fiat rates by date', () => {
      const v2Requests = [
        { currency_pair: 'BTC_iso:EUR', date: mockDate1.toISOString() }
      ]
      const v3Response: GetRatesParams = {
        targetFiat: 'USD',
        crypto: [
          {
            asset: { pluginId: 'bitcoin', tokenId: null },
            isoDate: mockDate1,
            rate: 50000
          }
        ],
        fiat: [
          {
            fiatCode: 'EUR',
            isoDate: mockDate1,
            rate: 1.1
          }
        ]
      }

      const result = convertV3ToV2(v2Requests, v3Response, currencyCodeMap)

      assert.strictEqual(result.length, 1)
      assert.match(result[0].exchangeRate ?? '', /^45454\./)
      assert.isUndefined(result[0].error)
    })

    it('should not match when dates differ', () => {
      const v2Requests = [
        { currency_pair: 'BTC_iso:USD', date: mockDate1.toISOString() }
      ]
      const v3Response: GetRatesParams = {
        targetFiat: 'USD',
        crypto: [
          {
            asset: { pluginId: 'bitcoin', tokenId: null },
            isoDate: mockDate2, // Different date!
            rate: 50000
          }
        ],
        fiat: []
      }

      const result = convertV3ToV2(v2Requests, v3Response, currencyCodeMap)

      assert.strictEqual(result.length, 1)
      assert.isNull(result[0].exchangeRate)
      assert.match(result[0].error ?? '', /No rate found for BTC/)
    })

    it('should handle multiple requests with different dates', () => {
      const v2Requests = [
        { currency_pair: 'BTC_iso:USD', date: mockDate1.toISOString() },
        { currency_pair: 'BTC_iso:USD', date: mockDate2.toISOString() }
      ]
      const v3Response: GetRatesParams = {
        targetFiat: 'USD',
        crypto: [
          {
            asset: { pluginId: 'bitcoin', tokenId: null },
            isoDate: mockDate1,
            rate: 50000
          },
          {
            asset: { pluginId: 'bitcoin', tokenId: null },
            isoDate: mockDate2,
            rate: 51000
          }
        ],
        fiat: []
      }

      const result = convertV3ToV2(v2Requests, v3Response, currencyCodeMap)

      assert.strictEqual(result.length, 2)
      assert.strictEqual(result[0].exchangeRate, '50000')
      assert.strictEqual(result[1].exchangeRate, '51000')
    })

    it('should not match when request has no date but response has date', () => {
      const v2Requests = [
        { currency_pair: 'BTC_iso:USD' } // No date specified
      ]
      const v3Response: GetRatesParams = {
        targetFiat: 'USD',
        crypto: [
          {
            asset: { pluginId: 'bitcoin', tokenId: null },
            isoDate: mockDate1,
            rate: 50000
          }
        ],
        fiat: []
      }

      const result = convertV3ToV2(v2Requests, v3Response, currencyCodeMap)

      assert.strictEqual(result.length, 1)
      // Should not match since request has no date but response has a date
      assert.isNull(result[0].exchangeRate)
      assert.match(result[0].error ?? '', /No rate found/)
    })

    it('should match correct date for crypto_crypto pairs', () => {
      const v2Requests = [
        { currency_pair: 'BTC_ETH', date: mockDate1.toISOString() }
      ]
      const v3Response: GetRatesParams = {
        targetFiat: 'USD',
        crypto: [
          {
            asset: { pluginId: 'bitcoin', tokenId: null },
            isoDate: mockDate1,
            rate: 50000
          },
          {
            asset: { pluginId: 'bitcoin', tokenId: null },
            isoDate: mockDate2,
            rate: 51000
          },
          {
            asset: { pluginId: 'ethereum', tokenId: null },
            isoDate: mockDate1,
            rate: 3000
          },
          {
            asset: { pluginId: 'ethereum', tokenId: null },
            isoDate: mockDate2,
            rate: 3100
          }
        ],
        fiat: []
      }

      const result = convertV3ToV2(v2Requests, v3Response, currencyCodeMap)

      assert.strictEqual(result.length, 1)
      // Should use date1 rates: 50000/3000
      assert.match(result[0].exchangeRate ?? '', /^16\.666/)
      assert.isUndefined(result[0].error)
    })

    it('should fail if one crypto has date and other does not', () => {
      const v2Requests = [
        { currency_pair: 'BTC_ETH', date: mockDate1.toISOString() }
      ]
      const v3Response: GetRatesParams = {
        targetFiat: 'USD',
        crypto: [
          {
            asset: { pluginId: 'bitcoin', tokenId: null },
            isoDate: mockDate1,
            rate: 50000
          },
          {
            asset: { pluginId: 'ethereum', tokenId: null },
            isoDate: mockDate2, // Wrong date
            rate: 3000
          }
        ],
        fiat: []
      }

      const result = convertV3ToV2(v2Requests, v3Response, currencyCodeMap)

      assert.strictEqual(result.length, 1)
      assert.isNull(result[0].exchangeRate)
      assert.match(result[0].error ?? '', /No rate found for ETH/)
    })
  })

  describe('basic conversions', () => {
    const mockDate = new Date('2023-10-23T12:00:00.000Z')

    it('should convert BTC_iso:USD with matching date', () => {
      const v2Requests = [
        { currency_pair: 'BTC_iso:USD', date: mockDate.toISOString() }
      ]
      const v3Response: GetRatesParams = {
        targetFiat: 'USD',
        crypto: [
          {
            asset: { pluginId: 'bitcoin', tokenId: null },
            isoDate: mockDate,
            rate: 50000
          }
        ],
        fiat: []
      }

      const result = convertV3ToV2(v2Requests, v3Response, currencyCodeMap)

      assert.strictEqual(result.length, 1)
      assert.strictEqual(result[0].exchangeRate, '50000')
    })

    it('should convert iso:USD_BTC (inverted) with matching date', () => {
      const v2Requests = [
        { currency_pair: 'iso:USD_BTC', date: mockDate.toISOString() }
      ]
      const v3Response: GetRatesParams = {
        targetFiat: 'USD',
        crypto: [
          {
            asset: { pluginId: 'bitcoin', tokenId: null },
            isoDate: mockDate,
            rate: 50000
          }
        ],
        fiat: []
      }

      const result = convertV3ToV2(v2Requests, v3Response, currencyCodeMap)

      assert.strictEqual(result.length, 1)
      assert.match(result[0].exchangeRate ?? '', /^0\.00002/)
    })

    it('should handle error when rate not found', () => {
      const v2Requests = [
        { currency_pair: 'BTC_iso:USD', date: mockDate.toISOString() }
      ]
      const v3Response: GetRatesParams = {
        targetFiat: 'USD',
        crypto: [],
        fiat: []
      }

      const result = convertV3ToV2(v2Requests, v3Response, currencyCodeMap)

      assert.strictEqual(result.length, 1)
      assert.isNull(result[0].exchangeRate)
      assert.match(result[0].error ?? '', /No rate found for BTC/)
    })
  })

  describe('round-trip conversion with multiple dates', () => {
    it('should properly handle same asset requested at different times', () => {
      const date1 = '2023-10-23T12:00:00.000Z'
      const date2 = '2023-10-24T12:00:00.000Z'

      // V2 requests: same asset (BTC) at different dates
      const v2Requests = [
        { currency_pair: 'BTC_iso:USD', date: date1 },
        { currency_pair: 'BTC_iso:USD', date: date2 }
      ]

      // Convert to V3
      const v3Request = convertV2(v2Requests, currencyCodeMap)

      // Should have 2 BTC entries with different dates
      assert.strictEqual(v3Request.crypto.length, 2)
      assert.strictEqual(v3Request.crypto[0].asset.pluginId, 'bitcoin')
      assert.strictEqual(v3Request.crypto[1].asset.pluginId, 'bitcoin')
      assert.strictEqual(v3Request.crypto[0].isoDate?.toISOString(), date1)
      assert.strictEqual(v3Request.crypto[1].isoDate?.toISOString(), date2)

      // Mock V3 response with both dates
      const v3Response: GetRatesParams = {
        targetFiat: 'USD',
        crypto: [
          {
            asset: { pluginId: 'bitcoin', tokenId: null },
            isoDate: new Date(date1),
            rate: 50000
          },
          {
            asset: { pluginId: 'bitcoin', tokenId: null },
            isoDate: new Date(date2),
            rate: 51000
          }
        ],
        fiat: []
      }

      // Convert back to V2
      const v2Results = convertV3ToV2(v2Requests, v3Response, currencyCodeMap)

      // Should have 2 results with correct dates and rates
      assert.strictEqual(v2Results.length, 2)
      assert.strictEqual(v2Results[0].currency_pair, 'BTC_iso:USD')
      assert.strictEqual(v2Results[0].date, date1)
      assert.strictEqual(v2Results[0].exchangeRate, '50000')

      assert.strictEqual(v2Results[1].currency_pair, 'BTC_iso:USD')
      assert.strictEqual(v2Results[1].date, date2)
      assert.strictEqual(v2Results[1].exchangeRate, '51000')
    })
  })
})
