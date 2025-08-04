import { RateProvider } from '../types'
import { coingecko } from './coingecko/coingecko'
import { coinmarketcap } from './coinmarketcap/coinmarketcap'
// import { coinmonitor } from './coinmonitor'
import { coinstore } from './coinstore'
import { couch } from './couch'
import { currencyconverter } from './currencyconverter'
import { midgard } from './midgard'
import { redis } from './redis'
import { wazirx } from './wazirx'

// Order matters here. The array will determine the order of priority within each provider type.
const looselyOrderedProviders: RateProvider[] = [
  // coinmonitor, // down?
  coinstore,
  midgard,
  wazirx,
  coinmarketcap,
  coingecko,
  currencyconverter,
  couch,
  redis
]

export const memoryProviders = looselyOrderedProviders.filter(
  p => p.type === 'memory'
)
export const dbProviders = looselyOrderedProviders.filter(p => p.type === 'db')
export const apiProviders = looselyOrderedProviders.filter(
  p => p.type === 'api'
)
