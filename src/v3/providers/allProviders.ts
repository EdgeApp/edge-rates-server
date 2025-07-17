import { RateProvider } from '../types'
import { coinmarketcap } from './coinmarketcap/coinmarketcap'

// Order matters here. The array will determine the order of priority within each provider type.
const looselyOrderedProviders: RateProvider[] = [coinmarketcap]

const memoryProviders = looselyOrderedProviders.filter(p => p.type === 'memory')
const dbProviders = looselyOrderedProviders.filter(p => p.type === 'db')
const apiProviders = looselyOrderedProviders.filter(p => p.type === 'api')

export const providers: RateProvider[] = [
  ...memoryProviders,
  ...dbProviders,
  ...apiProviders
]
