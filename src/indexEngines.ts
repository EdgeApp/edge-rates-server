import { ratesEngine } from './ratesEngine'
import { uniqueIdEngine } from './uniqueIdEngine'

ratesEngine().catch(e => console.log(e))
uniqueIdEngine().catch(e => console.log(e))
