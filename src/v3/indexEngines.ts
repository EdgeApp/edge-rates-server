import { providers } from './providers/allProviders'
import { RateEngine } from './types'

const HOUR = 60 * 60 * 1000
const frequencyToMs = (
  frequency: 'hour' | 'day' | 'week' | 'month'
): number => {
  switch (frequency) {
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
  frequency: 'hour' | 'day' | 'week' | 'month'
): Promise<void> => {
  const startTime = Date.now()
  const delayMs = frequencyToMs(frequency)

  while (true) {
    try {
      await engine()
    } catch (err) {
      console.error(`Engine failed to run '${providerId} ${frequency}':`, err)
    }

    const now = Date.now()
    const timeSinceStart = now - startTime
    const timeToWait = Math.max(0, delayMs - timeSinceStart)
    await new Promise(resolve => setTimeout(resolve, timeToWait))
  }
}

const startEngines = (): void => {
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
