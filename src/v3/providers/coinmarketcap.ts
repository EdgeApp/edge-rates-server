import { RateEngine, RateProvider } from '../types'

const dailyEngine: RateEngine = () => {
  console.log('Nothing to do')
}

export const coinmarketcap: RateProvider = {
  providerId: 'coinmarketcap',
  type: 'api',
  // eslint-disable-next-line @typescript-eslint/require-await
  getCryptoRates: async ({ targetFiat, rates }) => {
    return []
  },
  // eslint-disable-next-line @typescript-eslint/require-await
  getFiatRates: async ({ targetFiat, rates }) => {
    return []
  },
  engines: [
    {
      frequency: 'day',
      engine: dailyEngine
    }
  ]
}
