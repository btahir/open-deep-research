import { NextResponse } from 'next/server';
import { searchRatelimit } from '@/lib/redis';
import { CONFIG } from '@/lib/config';

const BING_ENDPOINT = 'https://api.bing.microsoft.com/v7.0/search';
const SERPER_ENDPOINT = 'https://google.serper.dev/search';

const SERPER_API_KEY = process.env.SERPER_API_KEY;
const AZURE_SUB_KEY = process.env.AZURE_SUB_KEY;

type TimeFilter = '24h' | 'week' | 'month' | 'year' | 'all';

function getFreshness(timeFilter: TimeFilter): string {
  switch (timeFilter) {
    case '24h':
      return 'Day';
    case 'week':
      return 'Week';
    case 'month':
      return 'Month';
    case 'year':
      return 'Year';
    default:
      return '';
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { query, timeFilter = 'all' } = body;

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      );
    }

    if (CONFIG.rateLimits.enabled) {
      const { success } = await searchRatelimit.limit(query);
      if (!success) {
        return NextResponse.json(
          { error: 'Too many requests. Please wait a moment before trying again.' },
          { status: 429 }
        );
      }
    }

    if (AZURE_SUB_KEY) {
      return await fetchFromAzure(query, timeFilter);
    } else if (SERPER_API_KEY) {
      return await fetchFromSerper(query);
    }

    return NextResponse.json(
      { error: 'No valid search API keys configured. Please check your environment variables.' },
      { status: 500 }
    );
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unexpected error occurred while fetching search results' },
      { status: 500 }
    );
  }
}

async function fetchFromAzure(query: string, timeFilter: TimeFilter) {
  const params = new URLSearchParams({
    q: query,
    count: CONFIG.search.resultsPerPage.toString(),
    mkt: CONFIG.search.market,
    safeSearch: CONFIG.search.safeSearch,
    textFormat: 'HTML',
    textDecorations: 'true',
  });

  const freshness = getFreshness(timeFilter);
  if (freshness) {
    params.append('freshness', freshness);
  }

  const response = await fetch(`${BING_ENDPOINT}?${params.toString()}`, {
    headers: {
      'Ocp-Apim-Subscription-Key': AZURE_SUB_KEY!,
      'Accept-Language': 'en-US',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    return NextResponse.json(
      { error: errorData?.message || `Azure Search API returned error ${response.status}` },
      { status: response.status }
    );
  }

  const data = await response.json();
  return NextResponse.json(data);
}

async function fetchFromSerper(query: string) {
  const response = await fetch(SERPER_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': SERPER_API_KEY!,
    },
    body: JSON.stringify({
      q: query,
      gl: CONFIG.search.market
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    return NextResponse.json(
      { error: errorData?.message || `Serper API returned error ${response.status}` },
      { status: response.status }
    );
  }

  const serperData = await response.json();

  // Mapping Serper response to match Azure format so that downstream tasks aren't modified
  const mappedResults = serperData.organic.map((item: any) => ({
    name: item.title,
    url: item.link,
    snippet: item.snippet,
  }));

  return NextResponse.json({ webPages: { value: mappedResults } });
}
