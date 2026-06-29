import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import ollama from 'ollama'
import {
  geminiFlashThinkingModel,
  geminiModel,
  geminiFlashModel,
} from './gemini'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
})

const deepseek = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY || '',
})

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

type DeepSeekMessage = {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export async function generateWithGemini(
  systemPrompt: string,
  model: string
): Promise<string> {
  let result
  if (model === 'gemini-flash-thinking') {
    result = await geminiFlashThinkingModel.generateContent(systemPrompt)
  } else if (model === 'gemini-exp') {
    result = await geminiModel.generateContent(systemPrompt)
  } else {
    result = await geminiFlashModel.generateContent(systemPrompt)
  }
  const text = result.response.text()
  if (!text) {
    throw new Error('No response content from Gemini')
  }
  return text
}

export async function generateWithOpenAI(
  systemPrompt: string,
  model: string
): Promise<string> {
  const response = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: 'user',
        content: systemPrompt,
      },
    ],
  })
  const content = response.choices[0].message.content
  if (!content) {
    throw new Error('No response content from OpenAI')
  }
  return content
}

export async function generateWithDeepSeek(
  systemPrompt: string,
  model: string
): Promise<string> {
  try {
    const messages: DeepSeekMessage[] = [
      {
        role: 'user',
        content: systemPrompt,
      },
    ]

    const response = await deepseek.chat.completions.create({
      model: `deepseek-${model}`,
      messages: messages as any,
      max_tokens: 4000,
    })

    const content = response.choices[0].message.content
    if (!content) {
      throw new Error('No response content from DeepSeek')
    }

    // For the reasoner model, we can get additional reasoning content
    if (
      model === 'deepseek-reasoner' &&
      (response.choices[0].message as any).reasoning_content
    ) {
      console.log(
        'DeepSeek reasoning:',
        (response.choices[0].message as any).reasoning_content
      )
    }

    return content
  } catch (error) {
    console.error('DeepSeek API error:', error)
    throw error
  }
}

export async function generateWithAnthropic(
  systemPrompt: string,
  model: string
): Promise<string> {
  const response = await anthropic.messages.create({
    model,
    max_tokens: 3500,
    temperature: 0.9,
    messages: [
      {
        role: 'user',
        content: systemPrompt,
      },
    ],
  })
  const content = response.content[0].text
  if (!content) {
    throw new Error('No response content from Anthropic')
  }
  return content
}

export async function generateWithOllama(
  systemPrompt: string,
  model: string
): Promise<string> {
  const response = await ollama.chat({
    model: model.replace('ollama__', ''),
    messages: [{ role: 'user', content: systemPrompt }],
  })
  const content = response.message.content
  if (!content) {
    throw new Error('No response content from Ollama')
  }
  return content
}

export async function generateWithOpenRouter(
  systemPrompt: string,
  model: string
): Promise<string> {
  const response = await fetch(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model.replace('openrouter__', ''),
        messages: [
          {
            role: 'user',
            content: systemPrompt,
          },
        ],
      }),
    }
  )

  const responseData = await response.text()

  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${responseData}`)
  }

  let data
  try {
    data = JSON.parse(responseData)
  } catch (e) {
    console.log('error', e)
    throw new Error(`Failed to parse OpenRouter response: ${responseData}`)
  }

  if (!data.choices?.[0]?.message?.content) {
    throw new Error(
      `Invalid OpenRouter response format: ${JSON.stringify(data)}`
    )
  }

  return data.choices[0].message.content
}

export async function generateWithRequesty(
  systemPrompt: string,
  model: string
): Promise<string> {
  const response = await fetch(
    'https://router.requesty.ai/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.REQUESTY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model.replace('requesty__', ''),
        messages: [
          {
            role: 'user',
            content: systemPrompt,
          },
        ],
      }),
    }
  )

  const responseData = await response.text()

  if (!response.ok) {
    throw new Error(`Requesty API error: ${responseData}`)
  }

  let data
  try {
    data = JSON.parse(responseData)
  } catch (e) {
    console.log('error', e)
    throw new Error(`Failed to parse Requesty response: ${responseData}`)
  }

  if (!data.choices?.[0]?.message?.content) {
    throw new Error(
      `Invalid Requesty response format: ${JSON.stringify(data)}`
    )
  }

  return data.choices[0].message.content
}

export async function generateWithModel(
  systemPrompt: string,
  platformModel: string
): Promise<string> {
  const [platform, model] = platformModel.split('__')

  switch (platform) {
    case 'google':
      return generateWithGemini(systemPrompt, model)
    case 'openai':
      return generateWithOpenAI(systemPrompt, model)
    case 'deepseek':
      return generateWithDeepSeek(systemPrompt, model)
    case 'anthropic':
      return generateWithAnthropic(systemPrompt, model)
    case 'ollama':
      return generateWithOllama(systemPrompt, model)
    case 'openrouter':
      return generateWithOpenRouter(systemPrompt, model)
    case 'requesty':
      return generateWithRequesty(systemPrompt, model)
    default:
      throw new Error('Invalid platform specified')
  }
}
