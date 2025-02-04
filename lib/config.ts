export const CONFIG = {
  // Rate limits (requests per minute)
  rateLimits: {
    enabled: true, // Flag to enable/disable rate limiting
    search: 2,
    contentFetch: 20,
    reportGeneration: 2,
  },

  // Search settings
  search: {
    resultsPerPage: 10,
    maxSelectableResults: 3,
    safeSearch: 'Moderate' as const,
    market: 'en-US',
  },

  // AI Platform settings
  platforms: {
    google: {
      enabled: true,
      models: {
        'gemini-flash': {
          enabled: true,
          label: 'Gemini Flash',
        },
        'gemini-flash-thinking': {
          enabled: true,
          label: 'Gemini Flash Thinking',
        },
        'gemini-exp': {
          enabled: false,
          label: 'Gemini Exp',
        },
      },
    },
    openai: {
      enabled: true,
      models: {
        'gpt-4o': {
          enabled: false,
          label: 'GPT-4o',
        },
        'o1-mini': {
          enabled: false,
          label: 'o1-mini',
        },
        o1: {
          enabled: false,
          label: 'o1',
        },
      },
    },
    anthropic: {
      enabled: true,
      models: {
        'sonnet-3.5': {
          enabled: false,
          label: 'Claude 3 Sonnet',
        },
        'haiku-3.5': {
          enabled: false,
          label: 'Claude 3 Haiku',
        },
      },
    },
    deepseek: {
      enabled: true,
      models: {
        chat: {
          enabled: false,
          label: 'Chat',
        },
        reasoner: {
          enabled: false,
          label: 'Reasoner',
        },
      },
    },
  },
} as const
