export type Report = {
  title: string
  summary: string
  sections: {
    title: string
    content: string
  }[]
  sources: {
    id: string
    url: string
    name: string
  }[]
  usedSources?: number[] // Array of source indices that were actually used/cited
}
export interface Article {
  url: string
  title: string
  content: string
}

export type KnowledgeBaseReport = {
  id: string
  timestamp: number
  query: string
  report: Report
}

export type SearchResult = {
  id: string
  url: string
  name: string
  snippet: string
  isCustomUrl?: boolean
  score?: number
  content?: string
}

export type RankingResult = {
  url: string
  score: number
  reasoning: string
}

export type PlatformModel = {
  value: string
  label: string
  platform: string
  disabled: boolean
}

export type ModelVariant =
  | 'google__gemini-flash'
  | 'google__gemini-flash-thinking'
  | 'google__gemini-exp'
  | 'gpt-4o'
  | 'o1-mini'
  | 'o1'
  | 'claude-3-7-sonnet-latest'
  | 'claude-3-5-haiku-latest'
  | 'deepseek__chat'
  | 'deepseek__reasoner'
  | 'ollama__llama3.2'
  | 'ollama__deepseek-r1:14b'
  | 'openrouter__auto'
  | 'requesty__openai/gpt-4o-mini'

export type Status = {
  loading: boolean
  generatingReport: boolean
  agentStep: 'idle' | 'processing' | 'searching' | 'analyzing' | 'generating'
  fetchStatus: {
    total: number
    successful: number
    fallback: number
    sourceStatuses: Record<string, 'fetched' | 'preview'>
  }
  agentInsights: string[]
  searchQueries: string[]
}

export type State = {
  query: string
  timeFilter: string
  results: SearchResult[]
  selectedResults: string[]
  reportPrompt: string
  report: Report | null
  error: string | null
  newUrl: string
  isSourcesOpen: boolean
  selectedModel: string
  isAgentMode: boolean
  sidebarOpen: boolean
  activeTab: string
  status: Status
}

// Flow Component Types
export type BaseNodeData = {
  id?: string
  loading?: boolean
  error?: string
  parentId?: string
  childIds?: string[]
}

export type SearchNodeData = BaseNodeData & {
  query: string
  onFileUpload?: (file: File) => void
}

export type SelectionNodeData = BaseNodeData & {
  results: SearchResult[]
  onGenerateReport?: (
    selectedResults: SearchResult[],
    prompt: string
  ) => Promise<
    | { success: boolean; report: any; searchTerms: any; error?: undefined }
    | {
        success: boolean
        error: string
        report?: undefined
        searchTerms?: undefined
      }
    | undefined
  >
}

export type ReportNodeData = BaseNodeData & {
  report?: Report
  isSelected?: boolean
  onSelect?: (id: string) => void
  isConsolidated?: boolean
  isConsolidating?: boolean
}

export type SearchTermsNodeData = BaseNodeData & {
  searchTerms?: string[]
  onApprove?: (term: string) => void
}

// Combined interface for all node types with index signature for compatibility with xyflow
export interface FlowNodeData extends BaseNodeData {
  query?: string
  results?: SearchResult[]
  report?: Report
  searchTerms?: string[]
  question?: string
  onGenerateReport?: (
    selectedResults: SearchResult[],
    prompt: string
  ) => Promise<
    | { success: boolean; report: any; searchTerms: any; error?: undefined }
    | {
        success: boolean
        error: string
        report?: undefined
        searchTerms?: undefined
      }
    | undefined
  >
  onApprove?: (term?: string) => void
  onConsolidate?: () => void
  hasChildren?: boolean
  isSelected?: boolean
  onSelect?: (id: string) => void
  isConsolidated?: boolean
  isConsolidating?: boolean
  onFileUpload?: (file: File) => void
  [key: string]: any // This allows for dynamic properties required by xyflow
}

// Configuration for different node types
export interface NodeConfig {
  zIndex: number
  style?: React.CSSProperties
}
