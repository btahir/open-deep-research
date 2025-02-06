import { NextResponse } from 'next/server'
import { searchRatelimit } from '@/lib/redis'
import { CONFIG } from '@/lib/config'

const SERPER_API_ENDPOINT = 'https://google.serper.dev/search'

function mapSerperToAzure(serperResponse: any) {
  return {
    webPages: {
      value: serperResponse.organic?.map((result: any) => ({
        name: result.title,
        url: result.link,
        snippet: result.description,
        datePublished: new Date().toISOString() + 'Z',
      })) || []
    }
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { query } = body

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      )
    }

    if (CONFIG.rateLimits.enabled) {
      const { success } = await searchRatelimit.limit(query)
      if (!success) {
        return NextResponse.json(
          { error: 'Too many requests. Please wait a moment before trying again.' },
          { status: 429 }
        )
      }
    }

    const apiKey = process.env.SERPER_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Search API is not properly configured. Please check your environment variables.' },
        { status: 500 }
      )
    }

    const response = await fetch(SERPER_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: query,
        num: CONFIG.search.resultsPerPage,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => null)
      return NextResponse.json(
        { error: errorData?.error || `Search API returned error ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    const azureCompatibleData = mapSerperToAzure(data)
    return NextResponse.json(azureCompatibleData)
  } catch (error) {
    console.error('Search API error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error 
          ? error.message 
          : 'An unexpected error occurred while fetching search results'
      },
      { status: 500 }
    )
  }
}
