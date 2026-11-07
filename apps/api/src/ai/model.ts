import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';

const DEFAULT_MODELS = {
  anthropic: 'claude-opus-5-5',
  openai: 'gpt-5',
  google: 'gemini-2.5-pro',
} as const;
type Provider = keyof typeof DEFAULT_MODELS;

/** Pick the chat model from env so the provider can be swapped without code changes. */
export function getModel(): { model: LanguageModel; label: string } {
  const provider = (process.env.AI_PROVIDER ?? 'anthropic') as Provider;
  if (!(provider in DEFAULT_MODELS)) {
    throw new Error(`Unknown AI_PROVIDER "${provider}". Use anthropic, openai or google.`);
  }
  const id = process.env.AI_MODEL || DEFAULT_MODELS[provider];
  const factory = { anthropic, openai, google }[provider];
  return { model: factory(id), label: `${provider}/${id}` };
}
