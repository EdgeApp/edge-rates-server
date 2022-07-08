import { asMaybe, asObject } from 'cleaners'

export function asHealingObject(shape, fallback) {
  if (typeof shape === 'function') {
    return function asMaybeObject(raw) {
      if (typeof raw !== 'object' || raw == null) return {}

      const out = {}
      const keys = Object.keys(raw)
      for (let i = 0; i < keys.length; ++i) {
        const key = keys[i]
        if (key === '__proto__') continue
        try {
          out[key] = shape(raw[key])
        } catch (error) {}
      }
      return out
    }
  }

  const safeShape = { ...shape }
  for (const key of Object.keys(shape)) {
    safeShape[key] = asMaybe(shape[key], fallback[key])
  }
  return asMaybe(asObject(shape), fallback)
}
