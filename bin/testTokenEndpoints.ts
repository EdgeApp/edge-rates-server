import fetch from 'node-fetch'

const baseUrl = process.env.TEST_URL ?? 'http://127.0.0.1:8008'

interface TestResult {
  name: string
  passed: boolean
  error?: string
  response?: {
    status: number
    body: unknown
  }
}

const testResults: TestResult[] = []

const runTest = async (
  name: string,
  testFn: () => Promise<{
    passed: boolean
    error?: string
    response?: { status: number; body: unknown }
  }>
): Promise<void> => {
  try {
    const result = await testFn()
    testResults.push({
      name,
      passed: result.passed,
      error: result.error,
      response: result.response
    })
    const status = result.passed ? '✓' : '✗'
    console.log(`${status} ${name}`)
    if (!result.passed && result.error != null && result.error !== '') {
      console.log(`  Error: ${result.error}`)
    }
    if (result.response != null) {
      console.log(`  Status: ${result.response.status}`)
      if (result.response.status >= 400) {
        console.log(`  Body: ${JSON.stringify(result.response.body, null, 2)}`)
      } else if (!result.passed) {
        // Show response body for debugging failed tests
        console.log(
          `  Response: ${JSON.stringify(result.response.body, null, 2)}`
        )
      }
    }
  } catch (error: unknown) {
    testResults.push({
      name,
      passed: false,
      error: String(error)
    })
    console.log(`✗ ${name}`)
    console.log(`  Error: ${String(error)}`)
  }
}

const makeRequest = async (
  endpoint: string,
  queryParams?: Record<string, string>
): Promise<{ status: number; body: unknown }> => {
  const url = new URL(`${baseUrl}${endpoint}`)
  if (queryParams != null) {
    Object.entries(queryParams).forEach(([key, value]) => {
      url.searchParams.append(key, value)
    })
  }

  const response = await fetch(url.toString())
  const body = await response.json().catch(async () => await response.text())

  return {
    status: response.status,
    body
  }
}

// ---------------------------
// Test: /v1/getToken
// ---------------------------

const testGetToken = async (): Promise<void> => {
  console.log('\n=== Testing /v1/getToken ===\n')

  // Test case: tokenId="faketoken", pluginIds="ethereum", result=[]
  await runTest(
    'getToken - faketoken with ethereum pluginId (expect empty array)',
    async () => {
      const response = await makeRequest('/v1/getToken', {
        tokenId: 'faketoken',
        pluginId: 'ethereum'
      })
      const passed =
        response.status === 200 &&
        Array.isArray(response.body) &&
        response.body.length === 0
      const bodyLength = Array.isArray(response.body)
        ? response.body.length
        : 'not an array'
      return {
        passed,
        response,
        error: passed
          ? undefined
          : `Expected 200 with empty array, got length ${String(bodyLength)}`
      }
    }
  )

  // Test case: tokenId="dac17f958d2ee523a2206206994597c13d831ec7", pluginIds="ethereum"
  // result=[{rank: 3, contractAddress: "0xdac17f958d2ee523a2206206994597c13d831ec7", currencyCode: "USDT", displayName: "Tether", multiplier: 6, chainPluginId: "ethereum", tokenId: "dac17f958d2ee523a2206206994597c13d831ec7"}]
  await runTest(
    'getToken - USDT tokenId with ethereum pluginId (expect USDT object)',
    async () => {
      const response = await makeRequest('/v1/getToken', {
        tokenId: 'dac17f958d2ee523a2206206994597c13d831ec7',
        pluginId: 'ethereum'
      })
      const isArray = Array.isArray(response.body)
      const bodyArray = isArray ? (response.body as unknown[]) : []
      const hasLength = isArray && bodyArray.length === 1
      let hasCorrectFields = false
      if (hasLength) {
        const item = bodyArray[0] as {
          rank?: number
          contractAddress?: string
          currencyCode?: string
          displayName?: string
          multiplier?: number
          chainPluginId?: string
          tokenId?: string
        }
        hasCorrectFields =
          item.contractAddress ===
            '0xdac17f958d2ee523a2206206994597c13d831ec7' &&
          item.currencyCode === 'USDT' &&
          item.displayName === 'Tether' &&
          item.multiplier === 6 &&
          item.chainPluginId === 'ethereum' &&
          item.tokenId === 'dac17f958d2ee523a2206206994597c13d831ec7'
      }
      const passed = response.status === 200 && hasLength && hasCorrectFields
      const bodyLength = isArray ? bodyArray.length : 'N/A'
      return {
        passed,
        response,
        error: passed
          ? undefined
          : `Expected 200 with array containing USDT object. Array: ${String(
              isArray
            )}, Length: ${String(bodyLength)}, Fields match: ${String(
              hasCorrectFields
            )}`
      }
    }
  )
}

// ---------------------------
// Test: /v1/findTokens
// ---------------------------

const testFindTokens = async (): Promise<void> => {
  console.log('\n=== Testing /v1/findTokens ===\n')

  // Test case: searchTerm="", result=error
  await runTest('findTokens - empty searchTerm (expect error)', async () => {
    const response = await makeRequest('/v1/findTokens', {
      searchTerm: ''
    })
    const passed = response.status === 400
    return {
      passed,
      response,
      error: passed
        ? undefined
        : `Expected 400 error for empty searchTerm, got status ${response.status}`
    }
  })

  // Test case: searchTerm="USDC", result=array length greater than 1
  await runTest(
    'findTokens - USDC search (expect array length > 1)',
    async () => {
      const response = await makeRequest('/v1/findTokens', {
        searchTerm: 'USDC'
      })
      const isArray = Array.isArray(response.body)
      const bodyArray = isArray ? (response.body as unknown[]) : []
      const length = bodyArray.length
      const passed = response.status === 200 && isArray && length > 1
      return {
        passed,
        response,
        error: passed
          ? undefined
          : `Expected 200 with array length > 1, got length ${length}`
      }
    }
  )

  // Test case: searchTerm="USDC", pluginIds="ethereum", result=array length greater than 1
  await runTest(
    'findTokens - USDC search with ethereum pluginId (expect array length > 1)',
    async () => {
      const response = await makeRequest('/v1/findTokens', {
        searchTerm: 'USDC',
        pluginIds: 'ethereum'
      })
      const isArray = Array.isArray(response.body)
      const bodyArray = isArray ? (response.body as unknown[]) : []
      const length = bodyArray.length
      const passed = response.status === 200 && isArray && length > 1
      return {
        passed,
        response,
        error: passed
          ? undefined
          : `Expected 200 with array length > 1, got length ${length}`
      }
    }
  )

  // Test case: searchTerm="0xdac17f958d2ee523a2206206994597c13d831ec7", pluginIds="ethereum", result=array length equal 1
  await runTest(
    'findTokens - contract address search lowercase (expect array length = 1)',
    async () => {
      const response = await makeRequest('/v1/findTokens', {
        searchTerm: '0xdac17f958d2ee523a2206206994597c13d831ec7',
        pluginIds: 'ethereum'
      })
      const isArray = Array.isArray(response.body)
      const bodyArray = isArray ? (response.body as unknown[]) : []
      const length = bodyArray.length
      const passed = response.status === 200 && isArray && length === 1
      return {
        passed,
        response,
        error: passed
          ? undefined
          : `Expected 200 with array length = 1, got length ${length}`
      }
    }
  )

  // Test case: searchTerm="0xdAC17F958D2ee523a2206206994597C13D831ec7", pluginIds="ethereum", result=array length equal 1
  await runTest(
    'findTokens - contract address search mixed case (expect array length = 1)',
    async () => {
      const response = await makeRequest('/v1/findTokens', {
        searchTerm: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        pluginIds: 'ethereum'
      })
      const isArray = Array.isArray(response.body)
      const bodyArray = isArray ? (response.body as unknown[]) : []
      const length = bodyArray.length
      const passed = response.status === 200 && isArray && length === 1
      return {
        passed,
        response,
        error: passed
          ? undefined
          : `Expected 200 with array length = 1, got length ${length}`
      }
    }
  )

  // Test case: searchTerm="0x5D02aB2ff137604eD236A06d52BFEac93133E689", pluginIds="polygon", result=array length equal 0
  await runTest(
    'findTokens - non-existent contract address search (expect array length = 0)',
    async () => {
      const response = await makeRequest('/v1/findTokens', {
        searchTerm: '0x5D02aB2ff137604eD236A06d52BFEac93133E689',
        pluginIds: 'polygon'
      })
      const isArray = Array.isArray(response.body)
      const bodyArray = isArray ? (response.body as unknown[]) : []
      const length = bodyArray.length
      const passed = response.status === 200 && isArray && length === 0
      return {
        passed,
        response,
        error: passed
          ? undefined
          : `Expected 200 with array length = 0, got length ${length}`
      }
    }
  )

  // Test case: searchTerm="USDC", pluginIds="ethereum,polygon", result=array length greater than 2
  await runTest(
    'findTokens - USDC search with ethereum,polygon pluginIds (expect array length > 2)',
    async () => {
      const response = await makeRequest('/v1/findTokens', {
        searchTerm: 'USDC',
        pluginIds: 'ethereum,polygon'
      })
      const isArray = Array.isArray(response.body)
      const bodyArray = isArray ? (response.body as unknown[]) : []
      const length = bodyArray.length
      const passed = response.status === 200 && isArray && length > 2
      return {
        passed,
        response,
        error: passed
          ? undefined
          : `Expected 200 with array length > 2, got length ${length}`
      }
    }
  )

  // Test case: searchTerm="USDC", pluginIds="ethereum,polygon,bitcoin", result=array length greater than 2
  await runTest(
    'findTokens - USDC search with ethereum,polygon,bitcoin pluginIds (expect array length > 2)',
    async () => {
      const response = await makeRequest('/v1/findTokens', {
        searchTerm: 'USDC',
        pluginIds: 'ethereum,polygon,bitcoin'
      })
      const isArray = Array.isArray(response.body)
      const bodyArray = isArray ? (response.body as unknown[]) : []
      const length = bodyArray.length
      const passed = response.status === 200 && isArray && length > 2
      return {
        passed,
        response,
        error: passed
          ? undefined
          : `Expected 200 with array length > 2, got length ${length}`
      }
    }
  )

  // Test case: searchTerm="USDCUSDCUSDCUSDCUSDCUSDCUSDCUSDC", result=[]
  await runTest(
    'findTokens - long fake search term (expect empty array)',
    async () => {
      const response = await makeRequest('/v1/findTokens', {
        searchTerm: 'USDCUSDCUSDCUSDCUSDCUSDCUSDCUSDC'
      })
      const isArray = Array.isArray(response.body)
      const bodyArray = isArray ? (response.body as unknown[]) : []
      const length = bodyArray.length
      const passed = response.status === 200 && isArray && length === 0
      return {
        passed,
        response,
        error: passed
          ? undefined
          : `Expected 200 with empty array, got length ${length}`
      }
    }
  )
}

// ---------------------------
// Test: /v1/listTokens
// ---------------------------

const testListTokens = async (): Promise<void> => {
  console.log('\n=== Testing /v1/listTokens ===\n')

  // Test case: page=1, pageSize=10, result=array length 10
  await runTest(
    'listTokens - page 1, pageSize 10 (expect array length = 10)',
    async () => {
      const response = await makeRequest('/v1/listTokens', {
        page: '1',
        pageSize: '10'
      })
      const isArray = Array.isArray(response.body)
      const bodyArray = isArray ? (response.body as unknown[]) : []
      const length = bodyArray.length
      const passed = response.status === 200 && isArray && length === 10
      return {
        passed,
        response,
        error: passed
          ? undefined
          : `Expected 200 with array length = 10, got length ${length}`
      }
    }
  )

  // Test case: page=1, pageSize=5, pluginIds="ethereum", result=error
  await runTest(
    'listTokens - page 1, pageSize 5, pluginIds ethereum (expect error)',
    async () => {
      const response = await makeRequest('/v1/listTokens', {
        page: '1',
        pageSize: '5',
        pluginIds: 'ethereum'
      })
      const passed = response.status === 400
      return {
        passed,
        response,
        error: passed
          ? undefined
          : `Expected 400 error for pageSize < 10, got status ${response.status}`
      }
    }
  )

  // Test case: page=-1, pageSize=15, pluginIds="ethereum", result=error
  await runTest(
    'listTokens - page -1, pageSize 15, pluginIds ethereum (expect error)',
    async () => {
      const response = await makeRequest('/v1/listTokens', {
        page: '-1',
        pageSize: '15',
        pluginIds: 'ethereum'
      })
      const passed = response.status === 400
      return {
        passed,
        response,
        error: passed
          ? undefined
          : `Expected 400 error for page < 0, got status ${response.status}`
      }
    }
  )

  // Test case: page=1, pageSize=15, pluginIds="ethereum", result=array length 15
  await runTest(
    'listTokens - page 1, pageSize 15, pluginIds ethereum (expect array length = 15)',
    async () => {
      const response = await makeRequest('/v1/listTokens', {
        page: '1',
        pageSize: '15',
        pluginIds: 'ethereum'
      })
      const isArray = Array.isArray(response.body)
      const bodyArray = isArray ? (response.body as unknown[]) : []
      const length = bodyArray.length
      const passed = response.status === 200 && isArray && length === 15
      return {
        passed,
        response,
        error: passed
          ? undefined
          : `Expected 200 with array length = 15, got length ${length}`
      }
    }
  )
}

// ---------------------------
// Command-line argument parsing
// ---------------------------

const parseArgs = (): string | null => {
  const args = process.argv.slice(2)

  // Check for --test or -t flag
  const testIndex = args.findIndex(arg => arg === '--test' || arg === '-t')
  if (testIndex !== -1 && args[testIndex + 1] != null) {
    return args[testIndex + 1]
  }

  // Check for positional argument (first arg if it's a valid test name)
  if (args.length > 0) {
    const testName = args[0].toLowerCase()
    if (
      testName === 'gettoken' ||
      testName === 'findtokens' ||
      testName === 'listtokens'
    ) {
      return testName
    }
  }

  return null
}

const getTestName = (arg: string | null): string | null => {
  if (arg == null) return null

  const normalized = arg.toLowerCase()
  if (normalized === 'gettoken' || normalized === 'get') {
    return 'getToken'
  }
  if (normalized === 'findtokens' || normalized === 'find') {
    return 'findTokens'
  }
  if (normalized === 'listtokens' || normalized === 'list') {
    return 'listTokens'
  }

  return null
}

// ---------------------------
// Main
// ---------------------------

const main = async (): Promise<void> => {
  const testArg = parseArgs()
  const testName = getTestName(testArg)

  console.log(`Testing endpoints at ${baseUrl}`)
  if (testName != null) {
    console.log(`Running only: ${testName}`)
  }
  console.log('='.repeat(60))

  if (testName === null || testName === 'getToken') {
    await testGetToken()
  }
  if (testName === null || testName === 'findTokens') {
    await testFindTokens()
  }
  if (testName === null || testName === 'listTokens') {
    await testListTokens()
  }

  if (testName != null && testResults.length === 0) {
    console.log(`\nNo tests found for: ${testArg}`)
    console.log('Valid test names: getToken, findTokens, listTokens')
    process.exit(1)
  }

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('SUMMARY')
  console.log('='.repeat(60))
  const passed = testResults.filter(r => r.passed).length
  const failed = testResults.filter(r => !r.passed).length
  const total = testResults.length

  console.log(`Total tests: ${total}`)
  console.log(`Passed: ${passed}`)
  console.log(`Failed: ${failed}`)

  if (failed > 0) {
    console.log('\nFailed tests:')
    testResults
      .filter(r => !r.passed)
      .forEach(r => {
        console.log(`  - ${r.name}`)
        if (r.error != null && r.error !== '') {
          console.log(`    ${r.error}`)
        }
      })
    process.exit(1)
  } else {
    console.log('\nAll tests passed!')
    process.exit(0)
  }
}

main().catch((error: unknown) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
