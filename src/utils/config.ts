import { readFileSync } from 'fs'
import { join as joinPath } from 'path'

import { asServerConfig } from '../types/cleaners'
import { ServerConfig } from '../types/types'

const configPath = joinPath(
  __dirname,
  '../../',
  process.env.CONFIG ?? 'serverConfig.json'
)

let config: ServerConfig

// Read JSON file
try {
  const filePath = joinPath(configPath)
  const configJson = readFileSync(filePath, 'utf8')
  config = JSON.parse(configJson)
} catch (error) {
  throw new Error(`Config load failed\n${JSON.stringify(error)}`)
}

// Validate config
try {
  config = asServerConfig(config)
} catch (error) {
  throw new Error(`Config validation failed\n${JSON.stringify(error)}`)
}

// Export typed config object
export { config }
