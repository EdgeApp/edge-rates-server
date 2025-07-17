import { RateProvider } from '../types'

// Order matters here. The array will determine the order of priority within each provider type.
const looselyOrderedProviders: RateProvider[] = []

const memoryProviders = looselyOrderedProviders.filter(p => p.type === 'memory')
const dbProviders = looselyOrderedProviders.filter(p => p.type === 'db')
const apiProviders = looselyOrderedProviders.filter(p => p.type === 'api')

export const providers: RateProvider[] = [
  ...memoryProviders,
  ...dbProviders,
  ...apiProviders
]
