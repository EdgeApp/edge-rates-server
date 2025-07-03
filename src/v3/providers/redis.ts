import { RateEngine, RateProvider } from '../types'

const dailyEngine: RateEngine = () => {
  console.log('Nothing to do')
}

export const redis: RateProvider = {
  providerId: 'redis',
  type: 'memory',
  // eslint-disable-next-line @typescript-eslint/require-await
  getCryptoRates: async ({ targetFiat, rates }) => {
    return []
  },
  // eslint-disable-next-line @typescript-eslint/require-await
  getFiatRates: async ({ targetFiat, rates }) => {
    return []
  },
  // eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-empty-function
  updateRates: async ({ targetFiat, fiat, crypto }) => {},
  engines: [
    {
      frequency: 'day',
      engine: dailyEngine
    }
  ]
}
