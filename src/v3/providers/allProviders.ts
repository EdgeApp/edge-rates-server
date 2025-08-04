import { RateProvider } from '../types'
import { coinmarketcap } from './coinmarketcap/coinmarketcap'

// Order matters here. The array will determine the order of priority within each provider type.
const looselyOrderedProviders: RateProvider[] = [coinmarketcap]

export const memoryProviders = looselyOrderedProviders.filter(
  p => p.type === 'memory'
)
export const dbProviders = looselyOrderedProviders.filter(p => p.type === 'db')
export const apiProviders = looselyOrderedProviders.filter(
  p => p.type === 'api'
)
