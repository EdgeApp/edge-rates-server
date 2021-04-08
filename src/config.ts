import { makeConfig } from 'cleaner-config'
import { asArray, asNumber, asObject, asOptional, asString } from 'cleaners'

export const asConfig = asObject({
  couchUri: asOptional(asString, 'http://admin:password@localhost:5984'),
  httpPort: asOptional(asNumber, 8008),
  infoServerAddress: asOptional(asString, 'info1.edge.app'),
  infoServerApiKey: asOptional(asString, ''),
  bridgeCurrencies: asOptional(asArray(asString), ['USD', 'BTC']),
  cryptoCurrencyCodes: asOptional(asArray(asString), [
    'BTC',
    'ETH',
    'USDT',
    'XRP',
    'DOT',
    'ADA',
    'LINK',
    'LTC',
    'BNB',
    'BCH',
    'XLM',
    'DOGE',
    'USDC',
    'UNI',
    'AAVE',
    'WBTC',
    'BSV',
    'EOS',
    'XMR',
    'XEM',
    'TRX',
    'SNX',
    'XTZ',
    'COMP',
    'THETA',
    'MKR',
    'SUSHI',
    'ATOM',
    'UMA',
    'VET'
  ]),
  fiatCurrencyCodes: asOptional(asArray(asString), [
    'EUR',
    'CNY',
    'JPY',
    'GBP'
  ]),
  ratesServerAddress: asOptional(asString, 'https://rates1.edge.app'),
  currencyConverterApiKey: asOptional(asString, ''),
  coinMarketCapHistoricalApiKey: asOptional(asString, ''),
  coinMarketCapCurrentApiKey: asOptional(asString, ''),
  slackWebhookUrl: asOptional(asString, ''),
  ratesLookbackLimit: asOptional(asNumber, 604800000)
})

export const config = makeConfig(asConfig, 'serverConfig.json')
