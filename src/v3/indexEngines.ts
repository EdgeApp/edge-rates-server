import { snooze } from '../utils/utils'
import { ONE_HOUR } from './constants'
import {
  apiProviders,
  dbProviders,
  memoryProviders
} from './providers/allProviders'
import { Frequency, RateEngine } from './types'

const frequencyToMs: Record<Frequency, number> = {
  minute: 60 * 1000,
  hour: ONE_HOUR,
  day: 24 * ONE_HOUR,
  week: 7 * 24 * ONE_HOUR,
  month: 30 * 24 * ONE_HOUR
}

const createEngineLoop = async (
  providerId: string,
  engine: RateEngine,
  frequency: Frequency
): Promise<void> => {
  const delayMs = frequencyToMs[frequency]
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
