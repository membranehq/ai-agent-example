import { customProvider } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

export const myProvider = customProvider({
  languageModels: {
    'chat-model': anthropic('claude-4-opus-20250514'),
    'title-model': anthropic('claude-3-5-haiku-latest'),
    'refine-apps-model': anthropic('claude-4-opus-20250514'),
  },
});
