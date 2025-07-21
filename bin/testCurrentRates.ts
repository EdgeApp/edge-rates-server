const fetchem = async (): Promise<void> => {
  const response = await fetch('http://127.0.0.1:8087/v3/rates', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      targetFiat: 'USD',
      crypto: [
        {
          isoDate: new Date().toISOString(),
          asset: {
            pluginId: 'bitcoin',
            tokenId: null
          }
        },
        {
          isoDate: new Date().toISOString(),
          asset: {
            pluginId: 'ethereum',
            tokenId: null
          }
        },
        {
          isoDate: new Date().toISOString(),
          asset: {
            pluginId: 'ethereum',
            tokenId: 'a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
          }
        },
        {
          isoDate: new Date().toISOString(),
          asset: {
            pluginId: 'fio',
            tokenId: null
          }
        },
        {
          isoDate: new Date().toISOString(),
          asset: {
            pluginId: 'fio',
            tokenId: 'FaKeFiOtOkEn'
          }
        },
        {
          isoDate: new Date().toISOString(),
          asset: {
            pluginId: 'hedera',
            tokenId: null
          }
        },
        {
          isoDate: new Date().toISOString(),
          asset: {
            pluginId: 'optimism',
            tokenId: null
          }
        },
        {
          isoDate: new Date().toISOString(),
          asset: {
            pluginId: 'pulsechain',
            tokenId: null
          }
        },
        {
          isoDate: new Date().toISOString(),
          asset: {
            pluginId: 'rsk',
            tokenId: null
          }
        },
        {
          isoDate: new Date().toISOString(),
          asset: {
            pluginId: 'sonic',
            tokenId: null
          }
        },
        {
          isoDate: new Date().toISOString(),
          asset: {
            pluginId: 'bitcoincash',
            tokenId: null
          }
        },
        {
          isoDate: new Date().toISOString(),
          asset: {
            pluginId: 'digibyte',
            tokenId: null
          }
        },
        {
          isoDate: new Date().toISOString(),
          asset: {
            pluginId: 'dash',
            tokenId: null
          }
        },
        {
          isoDate: new Date().toISOString(),
          asset: {
            pluginId: 'dogecoin',
            tokenId: null
          }
        },
        {
          isoDate: new Date().toISOString(),
          asset: {
            pluginId: 'litecoin',
            tokenId: null
          }
        },
        {
          isoDate: new Date().toISOString(),
          asset: {
            pluginId: 'pivx',
            tokenId: null
          }
        },
        {
          isoDate: new Date().toISOString(),
          asset: {
            pluginId: 'zcash',
            tokenId: null
          }
        },
        {
          isoDate: new Date().toISOString(),
          asset: {
            pluginId: 'piratechain',
            tokenId: null
          }
        },
        {
          isoDate: new Date().toISOString(),
          asset: {
            pluginId: 'monero',
            tokenId: null
          }
        },
        {
          // should be in response but without a rate
          isoDate: new Date().toISOString(),
          asset: {
            pluginId: 'zano',
            tokenId: null
          }
        },
        {
          // cmc returns scientific notation
          isoDate: new Date().toISOString(),
          asset: {
            pluginId: 'tron',
            tokenId: 'TAFjULxiVgT4qWk6UZwjqwZXTSaGaqnVp4'
          }
        }
      ],
      fiat: []
    })
  })
  const json = await response.json()
  console.log(JSON.stringify(json, null, 2))
}
fetchem().catch(e => {
  console.error(e)
})
