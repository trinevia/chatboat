import { bedrock } from '@ai-sdk/amazon-bedrock';
import { anthropic } from '@ai-sdk/anthropic';
import { azure } from '@ai-sdk/azure';
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

/** Any self-hosted OpenAI-compatible server, e.g. vLLM or Ollama (`http://localhost:11434/v1`). */
function openaiCompatible(id: string): LanguageModel {
  const baseURL = process.env.AI_BASE_URL;
  if (!baseURL) throw new Error('AI_PROVIDER=openai-compatible needs AI_BASE_URL, e.g. http://localhost:11434/v1.');
  return createOpenAICompatible({
    name: 'openai-compatible',
    baseURL,
    apiKey: process.env.AI_API_KEY || undefined,
    includeUsage: true,
  }).chatModel(id);
}

/**
 * Default model per provider. `null` means there is no sensible default and `AI_MODEL` is required:
 * the Azure deployment name, or the model name served by vLLM / Ollama.
 */
const DEFAULT_MODELS = {
  anthropic: 'claude-opus-5-5',
  openai: 'gpt-5',
  google: 'gemini-2.5-pro',
  // Picked because it handles tool calling reliably among the models on the NVIDIA account.
  nvidia: 'nvidia/nemotron-3-ultra-550b-a55b',
  azure: null,
  // US cross-region inference profile; use the eu. / apac. prefix from other regions.
  bedrock: 'us.anthropic.claude-opus-5-5',
  'openai-compatible': null,
} as const satisfies Record<string, string | null>;
type Provider = keyof typeof DEFAULT_MODELS;
export const AI_PROVIDERS = Object.keys(DEFAULT_MODELS) as Provider[];

const FACTORIES: Record<Provider, (id: string) => LanguageModel> = {
  anthropic: id => anthropic(id),
  openai: id => openai(id),
  google: id => google(id),
  nvidia: id => nvidia.chatModel(id),
  // `id` is the Azure deployment name. Reads AZURE_RESOURCE_NAME and AZURE_API_KEY at request time.
  azure: id => azure(id),
  // Reads AWS_REGION plus AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY (or AWS_BEARER_TOKEN_BEDROCK).
  bedrock: id => bedrock(id),
  'openai-compatible': openaiCompatible,
};

function isProvider(provider: string): provider is Provider {
  return Object.hasOwn(DEFAULT_MODELS, provider);
}

/** A model by provider name and optional id, e.g. modelFor('nvidia', 'nvidia/nemotron-3.5-lightning-30b-a3b'). */
export function modelFor(provider: string, id?: string): { model: LanguageModel; label: string } {
  if (!isProvider(provider)) {
    throw new Error(`Unknown provider "${provider}". Use one of: ${AI_PROVIDERS.join(', ')}.`);
  }
  const modelId = id || DEFAULT_MODELS[provider];
  if (!modelId) throw new Error(`AI_PROVIDER=${provider} needs AI_MODEL (the deployment or model name).`);
  return { model: FACTORIES[provider](modelId), label: `${provider}/${modelId}` };
}

/** Pick the chat model from env so the provider can be swapped without code changes. */
export function getModel() {
  return modelFor(process.env.AI_PROVIDER ?? 'anthropic', process.env.AI_MODEL);
}

/** Env vars each provider needs. A list of groups means any one complete group is enough. */
const REQUIRED_ENV: Record<Provider, (string | string[][])[]> = {
  anthropic: ['ANTHROPIC_API_KEY'],
  openai: ['OPENAI_API_KEY'],
  google: ['GOOGLE_GENERATIVE_AI_API_KEY'],
  nvidia: ['NVIDIA_API_KEY'],
  azure: ['AZURE_RESOURCE_NAME', 'AZURE_API_KEY'],
  bedrock: ['AWS_REGION', [['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'], ['AWS_BEARER_TOKEN_BEDROCK']]],
  // AI_API_KEY is optional: local vLLM / Ollama usually run without one.
  'openai-compatible': ['AI_BASE_URL'],
};

export type AiProviderStatus = {
  provider: string;
  /** The model that will be used, or null when AI_MODEL is required and unset. */
  model: string | null;
  configured: boolean;
  /** Env vars still to set. Alternatives read like "AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY or AWS_BEARER_TOKEN_BEDROCK". */
  missing: string[];
};

/** Whether the configured AI provider has everything it needs, for the admin page. Never returns secret values. */
export function aiProviderStatus(env: NodeJS.ProcessEnv = process.env): AiProviderStatus {
  const provider = env.AI_PROVIDER || 'anthropic';
  if (!isProvider(provider)) {
    return {
      provider,
      model: env.AI_MODEL || null,
      configured: false,
      missing: [`AI_PROVIDER (one of: ${AI_PROVIDERS.join(', ')})`],
    };
  }
  const has = (name: string) => Boolean(env[name]?.trim());
  const missing: string[] = [];
  for (const req of REQUIRED_ENV[provider]) {
    if (typeof req === 'string') {
      if (!has(req)) missing.push(req);
    } else if (!req.some(group => group.every(has))) {
      missing.push(req.map(group => group.join(' + ')).join(' or '));
    }
  }
  const model = env.AI_MODEL || DEFAULT_MODELS[provider];
  if (!model) missing.push('AI_MODEL');
  return { provider, model, configured: missing.length === 0, missing };
}
