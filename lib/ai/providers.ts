import { customProvider } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';

export const myProvider = customProvider({
  languageModels: {
    'chat-model': anthropic('claude-4-opus-20250514'),
    'title-model': openai('gpt-4o'),
  },
});
