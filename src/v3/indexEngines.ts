import { snooze } from '../utils/utils'
import {
  apiProviders,
  dbProviders,
  memoryProviders
} from './providers/allProviders'
import { RateEngine } from './types'

const HOUR = 60 * 60 * 1000
const frequencyToMs = (
  frequency: 'minute' | 'hour' | 'day' | 'week' | 'month'
): number => {
  switch (frequency) {
    case 'minute':
      return 60 * 1000
    case 'hour':
      return HOUR
    case 'day':
      return 24 * HOUR
    case 'week':
      return 7 * 24 * HOUR
    case 'month':
      return 30 * 7 * 24 * HOUR
  }
}

const createEngineLoop = async (
  providerId: string,
  engine: RateEngine,
  frequency: 'minute' | 'hour' | 'day' | 'week' | 'month'
): Promise<void> => {
  const delayMs = frequencyToMs(frequency)
  while (true) {
    const startTime = Date.now()
    try {
      await engine()
    } catch (err) {
      console.error(`Engine failed to run '${providerId} ${frequency}':`, err)
    }

    const now = Date.now()
    const timeSinceStart = now - startTime
    const timeToWait = Math.max(0, delayMs - timeSinceStart)
    await snooze(timeToWait)
  }
}

const startEngines = (): void => {
  const providers = [...memoryProviders, ...dbProviders, ...apiProviders]
  for (const provider of providers) {
    if (provider.engines == null) continue

    for (const engine of provider.engines) {
      createEngineLoop(
        provider.providerId,
        engine.engine,
        engine.frequency
      ).catch(e => {
        console.error(
          `Engine failed to initialize '${provider.providerId} ${engine.frequency}':`,
          e
        )
      })
    }
  }
}
startEngines()
