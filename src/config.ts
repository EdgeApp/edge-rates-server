import { makeConfig } from 'cleaner-config'
import { asArray, asNumber, asObject, asOptional, asString } from 'cleaners'

// Customization:

const {
  COUCH_HOSTNAME = 'localhost',
  COUCH_PASSWORD = 'password',
  INFO_SERVER_ADDRESS = 'info1.edge.app',
  INFO_SERVER_API_KEY = '',
  RATES_SERVER_ADDRESS = 'https://rates1.edge.app',
  CURRENCY_CONVERTER_API_KEY = '',
  COIN_MARKET_CAP_API_KEY = '',
  COIN_MARKET_CAP_HISTORICAL_API_KEY = '',
  SLACK_WEBHOOK_URL = '',
  OPEN_EXCHANGE_RATES_API_KEY,
  NOMICS_API_KEY
} = process.env

// Config:

export const asConfig = asObject({
  couchUri: asOptional(
    asString,
    `http://admin:${COUCH_PASSWORD}@${COUCH_HOSTNAME}:5984`
  ),
  httpPort: asOptional(asNumber, 8008),
  infoServerAddress: asOptional(asString, INFO_SERVER_ADDRESS),
  infoServerApiKey: asOptional(asString, INFO_SERVER_API_KEY),
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
  ratesServerAddress: asOptional(asString, RATES_SERVER_ADDRESS),
  currencyConverterApiKey: asOptional(asString, CURRENCY_CONVERTER_API_KEY),
  currencyConverterBaseUrl: asOptional(asString, 'https://api.currconv.com'),
  coinMarketCapCurrentApiKey: asOptional(asString, COIN_MARKET_CAP_API_KEY),
  coinMarketCapHistoricalApiKey: asOptional(
    asString,
    COIN_MARKET_CAP_HISTORICAL_API_KEY
  ),
  coinMarketCapBaseUrl: asOptional(
    asString,
    'https://pro-api.coinmarketcap.com'
  ),
  slackWebhookUrl: asOptional(asString, SLACK_WEBHOOK_URL),
  openExchangeRatesApiKey: asOptional(asString, OPEN_EXCHANGE_RATES_API_KEY),
  openExchangeRatesBaseUrl: asOptional(
    asString,
    'https://openexchangerates.org'
  ),
  nomicsApiKey: asOptional(asString, NOMICS_API_KEY),
  nomicsBaseUrl: asOptional(asString, 'https://api.nomics.com'),
  coincapBaseUrl: asOptional(asString, 'https://api.coincap.io'),
  compoundBaseUrl: asOptional(
    asString,
    'https://api.compound.finance/api/v2/ctoken'
  ),
  ratesLookbackLimit: asOptional(asNumber, 604800000)
})

export const config = makeConfig(asConfig, 'serverConfig.json')
