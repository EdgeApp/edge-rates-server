const test1 = {
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
        pluginId: 'thorchainrune',
        tokenId: 'tcy'
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
    },
    {
      isoDate: new Date(
        new Date().setMonth(new Date().getMonth() - 1)
      ).toISOString(),
      asset: {
        pluginId: 'bitcoin',
        tokenId: null
      }
    },
    {
      isoDate: new Date(
        new Date().setMonth(new Date().getMonth() - 1)
      ).toISOString(),
      asset: {
        pluginId: 'ethereum',
        tokenId: null
      }
    },
    {
      isoDate: new Date(
        new Date().setMonth(new Date().getMonth() - 1)
      ).toISOString(),
      asset: {
        pluginId: 'ethereum',
        tokenId: 'a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
      }
    },
    {
      isoDate: new Date(new Date().setFullYear(new Date().getFullYear() - 1)),
      asset: {
        pluginId: 'bitcoin',
        tokenId: null
      }
    }
  ],
  fiat: [
    {
      isoDate: new Date().toISOString(),
      fiatCode: 'USD'
    },
    {
      isoDate: new Date().toISOString(),
      fiatCode: 'CAD'
    },
    {
      isoDate: new Date().toISOString(),
      fiatCode: 'INR'
    },
    {
      isoDate: '2025-07-20T02:46:52.364Z',
      fiatCode: 'EUR'
    }
  ]
}
const test2 = {
  targetFiat: 'ARS',
  crypto: [
    {
      isoDate: new Date().toISOString(),
      asset: {
        pluginId: 'bitcoin',
        tokenId: null
      }
    }
  ],
  fiat: []
}
const test3 = {
  targetFiat: 'INR',
  crypto: [
    {
      isoDate: new Date().toISOString(),
      asset: {
        pluginId: 'bitcoin',
        tokenId: null
      }
    }
  ],
  fiat: [
    {
      isoDate: new Date().toISOString(),
      fiatCode: 'USD'
    },
    {
      isoDate: new Date().toISOString(),
      fiatCode: 'CAD'
    },
    {
      isoDate: new Date().toISOString(),
      fiatCode: 'INR'
    }
  ]
}
const test4 = {
  targetFiat: 'USD',
  crypto: [
    {
      isoDate: '2025-06-29T00:45:12.345Z',
      asset: {
        pluginId: 'bitcoin',
        tokenId: null
      }
    },
    {
      isoDate: '2025-06-29T00:45:12.345Z',
      asset: {
        pluginId: 'ethereum',
        tokenId: null
      }
    },
    {
      isoDate: '2025-06-29T00:45:12.345Z',
      asset: {
        pluginId: 'ethereum',
        tokenId: 'a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
      }
    },
    {
      isoDate: '2025-06-29T00:45:12.345Z',
      asset: {
        pluginId: 'fio',
        tokenId: null
      }
    },
    {
      isoDate: '2025-06-29T00:45:12.345Z',
      asset: {
        pluginId: 'fio',
        tokenId: 'FaKeFiOtOkEn'
      }
    },
    {
      isoDate: '2025-06-29T00:45:12.345Z',
      asset: {
        pluginId: 'hedera',
        tokenId: null
      }
    },
    {
      isoDate: '2025-06-29T00:45:12.345Z',
      asset: {
        pluginId: 'optimism',
        tokenId: null
      }
    },
    {
      isoDate: '2025-06-29T00:45:12.345Z',
      asset: {
        pluginId: 'pulsechain',
        tokenId: null
      }
    },
    {
      isoDate: '2025-06-29T00:45:12.345Z',
      asset: {
        pluginId: 'rsk',
        tokenId: null
      }
    },
    {
      isoDate: '2025-06-29T00:45:12.345Z',
      asset: {
        pluginId: 'thorchainrune',
        tokenId: 'tcy'
      }
    },
    {
      isoDate: '2025-06-29T00:45:12.345Z',
      asset: {
        pluginId: 'sonic',
        tokenId: null
      }
    },
    {
      isoDate: '2025-06-29T00:45:12.345Z',
      asset: {
        pluginId: 'bitcoincash',
        tokenId: null
      }
    },
    {
      isoDate: '2025-06-29T00:45:12.345Z',
      asset: {
        pluginId: 'digibyte',
        tokenId: null
      }
    },
    {
      isoDate: '2025-06-29T00:45:12.345Z',
      asset: {
        pluginId: 'dash',
        tokenId: null
      }
    },
    {
      isoDate: '2025-06-29T00:45:12.345Z',
      asset: {
        pluginId: 'dogecoin',
        tokenId: null
      }
    },
    {
      isoDate: '2025-06-29T00:45:12.345Z',
      asset: {
        pluginId: 'litecoin',
        tokenId: null
      }
    },
    {
      isoDate: '2025-06-29T00:45:12.345Z',
      asset: {
        pluginId: 'pivx',
        tokenId: null
      }
    },
    {
      isoDate: '2025-06-29T00:45:12.345Z',
      asset: {
        pluginId: 'zcash',
        tokenId: null
      }
    },
    {
      isoDate: '2025-06-29T00:45:12.345Z',
      asset: {
        pluginId: 'piratechain',
        tokenId: null
      }
    },
    {
      isoDate: '2025-06-29T00:45:12.345Z',
      asset: {
        pluginId: 'monero',
        tokenId: null
      }
    },
    {
      // should be in response but without a rate
      isoDate: '2025-06-29T00:45:12.345Z',
      asset: {
        pluginId: 'zano',
        tokenId: null
      }
    },
    {
      // cmc returns scientific notation
      isoDate: '2025-06-29T00:45:12.345Z',
      asset: {
        pluginId: 'tron',
        tokenId: 'TAFjULxiVgT4qWk6UZwjqwZXTSaGaqnVp4'
      }
    },
    {
      isoDate: '2025-06-29T00:45:12.345Z',
      asset: {
        pluginId: 'bitcoin',
        tokenId: null
      }
    },
    {
      isoDate: '2025-06-29T00:45:12.345Z',
      asset: {
        pluginId: 'ethereum',
        tokenId: null
      }
    },
    {
      isoDate: '2025-06-29T00:45:12.345Z',
      asset: {
        pluginId: 'ethereum',
        tokenId: 'a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
      }
    },
    {
      isoDate: '2025-06-29T00:45:12.345Z',
      asset: {
        pluginId: 'bitcoin',
        tokenId: null
      }
    }
  ],
  fiat: [
    {
      isoDate: '2025-06-29T00:45:12.345Z',
      fiatCode: 'USD'
    },
    {
      isoDate: '2025-06-29T00:45:12.345Z',
      fiatCode: 'CAD'
    },
    {
      isoDate: '2025-06-29T00:45:12.345Z',
      fiatCode: 'EUR'
    }
  ]
}

const fetchem = async (test: object): Promise<any> => {
  const response = await fetch('http://127.0.0.1:8087/v3/rates', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(test)
  })
  const json = await response.json()
  return json
}

const main = async (): Promise<void> => {
  const test1Result = await fetchem(test1)
  console.log('test1', JSON.stringify(test1Result, null, 2))
  const test2Result = await fetchem(test2)
  console.log('test2', JSON.stringify(test2Result, null, 2))
  const test3Result = await fetchem(test3)
  console.log('test3', JSON.stringify(test3Result, null, 2))
  const test4Result = await fetchem(test4)
  console.log('test4', JSON.stringify(test4Result, null, 2))
}

main().catch(e => {
  console.error(e)
})
