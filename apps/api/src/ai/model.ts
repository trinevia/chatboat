import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';

/** NVIDIA NIM (build.nvidia.com) exposes an OpenAI-compatible API. */
const nvidia = createOpenAICompatible({
  name: 'nvidia',
  baseURL: process.env.NVIDIA_BASE_URL ?? 'https://integrate.api.nvidia.com/v1',
  apiKey: process.env.NVIDIA_API_KEY,
  // Streaming responses only report token usage when asked; needed for usage tracking.
  includeUsage: true,
});

const DEFAULT_MODELS = {
  anthropic: 'claude-opus-5-5',
  openai: 'gpt-5',
  google: 'gemini-2.5-pro',
  // Picked because it handles tool calling reliably among the models on the NVIDIA account.
  nvidia: 'nvidia/nemotron-3-ultra-550b-a55b',
} as const;
type Provider = keyof typeof DEFAULT_MODELS;

const FACTORIES: Record<Provider, (id: string) => LanguageModel> = {
  anthropic: id => anthropic(id),
  openai: id => openai(id),
  google: id => google(id),
  nvidia: id => nvidia.chatModel(id),
};

/** A model by provider name and optional id, e.g. modelFor('nvidia', 'nvidia/nemotron-3.5-lightning-30b-a3b'). */
export function modelFor(provider: string, id?: string): { model: LanguageModel; label: string } {
  if (!(provider in DEFAULT_MODELS)) {
    throw new Error(`Unknown provider "${provider}". Use one of: ${Object.keys(DEFAULT_MODELS).join(', ')}.`);
  }
  const p = provider as Provider;
  const modelId = id || DEFAULT_MODELS[p];
  return { model: FACTORIES[p](modelId), label: `${p}/${modelId}` };
}

/** Pick the chat model from env so the provider can be swapped without code changes. */
export function getModel() {
  return modelFor(process.env.AI_PROVIDER ?? 'anthropic', process.env.AI_MODEL);
}
