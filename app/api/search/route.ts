import { NextResponse } from 'next/server'
import { searchRatelimit } from '@/lib/redis'
import { CONFIG } from '@/lib/config'

const BING_ENDPOINT = 'https://api.bing.microsoft.com/v7.0/search'
const GOOGLE_ENDPOINT = 'https://customsearch.googleapis.com/customsearch/v1'
const EXA_ENDPOINT = 'https://api.exa.ai/search'
const SEARXNG_ENDPOINT = 'http://127.0.0.1:8080'

type TimeFilter = '24h' | 'week' | 'month' | 'year' | 'all'

function getBingFreshness(timeFilter: TimeFilter): string {
  switch (timeFilter) {
    case '24h':
      return 'Day'
    case 'week':
      return 'Week'
    case 'month':
      return 'Month'
    case 'year':
      return 'Year'
    default:
      return ''
  }
}

function getGoogleDateRestrict(timeFilter: TimeFilter): string | null {
  // Map our timeFilter to Google's dateRestrict values:
  // d1 for 24h, w1 for week, m1 for month, y1 for year
  switch (timeFilter) {
    case '24h':
      return 'd1'
    case 'week':
      return 'w1'
    case 'month':
      return 'm1'
    case 'year':
      return 'y1'
    default:
      return null
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      query,
      timeFilter = 'all',
      provider = CONFIG.search.provider,
      isTestQuery = false,
    } = body

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      )
    }

    // Return dummy results for test queries
    if (query.toLowerCase() === 'test' || isTestQuery) {
      return NextResponse.json({
        webPages: {
          value: [
            {
              id: 'test-1',
              url: 'https://example.com/test-1',
              name: 'Test Result 1',
              snippet:
                'This is a test search result for testing purposes. It contains some sample text about research and analysis.',
            },
            {
              id: 'test-2',
              url: 'https://example.com/test-2',
              name: 'Test Result 2',
              snippet:
                'Another test result with different content. This one discusses methodology and data collection.',
            },
            {
              id: 'test-3',
              url: 'https://example.com/test-3',
              name: 'Test Result 3',
              snippet:
                'A third test result focusing on academic research and scientific papers.',
            },
          ],
        },
      })
    }

    // Only check rate limit if enabled
    if (CONFIG.rateLimits.enabled) {
      const { success } = await searchRatelimit.limit(query)
      if (!success) {
        return NextResponse.json(
          {
            error:
              'Too many requests. Please wait a moment before trying again.',
          },
          { status: 429 }
        )
      }
    }

    if (provider === 'exa') {
      const exaApiKey = process.env.EXA_API_KEY
      if (!exaApiKey) {
        return NextResponse.json(
          {
            error:
              'Exa search API is not properly configured. Please check your environment variables.',
          },
          { status: 500 }
        )
      }

      try {
        const exaResponse = await fetch(EXA_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${exaApiKey}`,
          },
          body: JSON.stringify({
            query,
            type: 'auto',
            numResults: CONFIG.search.resultsPerPage,
            contents: {
              text: {
                maxCharacters: 500,
              },
            },
          }),
        })

        if (!exaResponse.ok) {
          if (exaResponse.status === 429) {
            return NextResponse.json(
              {
                error: 'Rate limit exceeded. Please try again later.',
              },
              { status: 429 }
            )
          }
          throw new Error(`Exa API error: ${exaResponse.status}`)
        }

        const response = await exaResponse.json()

        if (!response?.results) {
          throw new Error('Unexpected Exa API response format')
        }

        // Transform Exa results to match our format
        const transformedResults = {
          webPages: {
            value: response.results.map((item: any) => ({
              id: item.id || item.url,
              url: item.url,
              name: item.title || 'Untitled',
              snippet: item.text || '',
              publishedDate: item.publishedDate || undefined,
              author: item.author || undefined,
              image: item.image || undefined,
              favicon: item.favicon || undefined,
              score: item.score || undefined,
            })),
          },
        }

        return NextResponse.json(transformedResults)
      } catch (error: any) {
        console.error('Exa search error:', error)
        return NextResponse.json(
          {
            error: 'Failed to fetch search results from Exa.',
          },
          { status: 500 }
        )
      }
    }  else if (provider === 'searxng') {
      try {
        const params = new URLSearchParams({
          q: query,
          format: 'json',
          pageno: '1',
          language: 'all',
          time_range: timeFilter === 'all' ? '' : timeFilter,
          results: CONFIG.search.resultsPerPage.toString(),
        })

        const searxResponse = await fetch(
          `${SEARXNG_ENDPOINT}?${params.toString()}`
        )

        if (!searxResponse.ok) {
          throw new Error(`SearXNG API error: ${searxResponse.status}`)
        }

        const data = await searxResponse.json()

        if (!data.results || !Array.isArray(data.results)) {
          throw new Error('Invalid SearXNG response format')
        }

        // Transform SearXNG results to match our format
        const transformedResults = {
          webPages: {
            value: data.results.map((item: any) => ({
              id: item.url || `searx-${Math.random().toString(36).substr(2, 9)}`,
              url: item.url,
              name: item.title || 'Untitled',
              snippet: item.content || item.description || '',
              publishedDate: item.published_date || item.publishedDate,
              engine: item.engine,
              score: item.score,
            })),
          },
        }

        return NextResponse.json(transformedResults)
      } catch (error: any) {
        console.error('SearXNG search error:', error)
        return NextResponse.json(
          {
            error: 'Failed to fetch search results from SearXNG.',
          },
          { status: 500 }
        )
      }
    } else if (provider === 'google') {
      // Ensure required Google API variables are available.
      const googleApiKey = process.env.GOOGLE_SEARCH_API_KEY
      const googleCx = process.env.GOOGLE_SEARCH_CX
      if (!googleApiKey || !googleCx) {
        return NextResponse.json(
          {
            error:
              'Google search API is not properly configured. Please check your environment variables.',
          },
          { status: 500 }
        )
      }

      const params = new URLSearchParams({
        q: query,
        key: googleApiKey,
        cx: googleCx,
        num: CONFIG.search.resultsPerPage.toString(),
      })

      // Add Google's dateRestrict parameter if a time filter is applied
      const dateRestrict = getGoogleDateRestrict(timeFilter as TimeFilter)
      if (dateRestrict) {
        params.append('dateRestrict', dateRestrict)
      }

      // Set safe search parameter based on config
      params.append('safe', CONFIG.search.safeSearch.google)

      const googleResponse = await fetch(
        `${GOOGLE_ENDPOINT}?${params.toString()}`
      )

      if (!googleResponse.ok) {
        const errorData = await googleResponse.json().catch(() => null)

        // Check for quota exceeded error
        if (errorData?.error?.message?.includes('Quota exceeded')) {
          return NextResponse.json(
            {
              error:
                'Daily search limit reached. Please try again tomorrow or contact support for increased limits.',
            },
            { status: 429 }
          )
        }

        return NextResponse.json(
          {
            error:
              'An error occurred while fetching search results. Please try again later.',
          },
          { status: googleResponse.status }
        )
      }

      const data = await googleResponse.json()

      // Transform Google search results to match our format
      const transformedResults = {
        webPages: {
          value:
            data.items?.map((item: any) => ({
              id: item.cacheId || item.link,
              url: item.link,
              name: item.title,
              snippet: item.snippet,
            })) || [],
        },
      }

      return NextResponse.json(transformedResults)
    } else {
      // Default to Bing search
      const subscriptionKey = process.env.AZURE_SUB_KEY
      if (!subscriptionKey) {
        return NextResponse.json(
          {
            error:
              'Search API is not properly configured. Please check your environment variables.',
          },
          { status: 500 }
        )
      }

      const params = new URLSearchParams({
        q: query,
        count: CONFIG.search.resultsPerPage.toString(),
        mkt: CONFIG.search.market,
        safeSearch: CONFIG.search.safeSearch.bing,
        textFormat: 'HTML',
        textDecorations: 'true',
      })

      // Add freshness parameter for Bing if a time filter is applied
      const freshness = getBingFreshness(timeFilter as TimeFilter)
      if (freshness) {
        params.append('freshness', freshness)
      }

      const bingResponse = await fetch(
        `${BING_ENDPOINT}?${params.toString()}`,
        {
          headers: {
            'Ocp-Apim-Subscription-Key': subscriptionKey,
            'Accept-Language': 'en-US',
          },
        }
      )

      if (!bingResponse.ok) {
        if (bingResponse.status === 403) {
          console.error('Bing Search API 403 Error:', {
            status: bingResponse.status,
            headers: Object.fromEntries(bingResponse.headers.entries()),
            query,
            timeFilter,
          })

          try {
            const errorBody = await bingResponse.json()
            console.error('Bing Error Response:', errorBody)
          } catch (e) {
            console.error('Could not parse Bing error response', e)
          }

          return NextResponse.json(
            {
              error:
                'Monthly search quota exceeded. Please try again next month or contact support for increased limits.',
            },
            { status: 403 }
          )
        }
        const errorData = await bingResponse.json().catch(() => null)
        return NextResponse.json(
          {
            error:
              errorData?.message ||
              `Search API returned error ${bingResponse.status}`,
          },
          { status: bingResponse.status }
        )
      }

      const data = await bingResponse.json()
      return NextResponse.json(data)
    }
  } catch (error) {
    console.error('Search API error:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred while fetching search results',
      },
      { status: 500 }
    )
  }
}
