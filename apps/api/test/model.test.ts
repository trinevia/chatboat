import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { aiProviderStatus, modelFor } from '../src/ai/model';

const AI_ENV = [
  'AI_PROVIDER', 'AI_MODEL', 'AI_BASE_URL', 'AI_API_KEY',
  'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY', 'NVIDIA_API_KEY',
  'AZURE_RESOURCE_NAME', 'AZURE_API_KEY',
  'AWS_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN', 'AWS_BEARER_TOKEN_BEDROCK',
];

/** Start each test from a clean slate so the developer's real .env can't leak in. */
beforeEach(() => {
  for (const name of AI_ENV) vi.stubEnv(name, undefined);
});
afterEach(() => vi.unstubAllEnvs());

function stub(vars: Record<string, string>) {
  for (const [k, v] of Object.entries(vars)) vi.stubEnv(k, v);
}

describe('aiProviderStatus', () => {
  it('defaults to anthropic and reports the missing key', () => {
    expect(aiProviderStatus()).toEqual({
      provider: 'anthropic', model: 'claude-opus-5-5', configured: false, missing: ['ANTHROPIC_API_KEY'],
    });
    stub({ ANTHROPIC_API_KEY: 'sk' });
    expect(aiProviderStatus()).toMatchObject({ configured: true, missing: [] });
  });

  it.each([
    ['openai', 'OPENAI_API_KEY', 'gpt-5'],
    ['google', 'GOOGLE_GENERATIVE_AI_API_KEY', 'gemini-2.5-pro'],
    ['nvidia', 'NVIDIA_API_KEY', 'nvidia/nemotron-3-ultra-550b-a55b'],
  ])('%s needs %s', (provider, key, model) => {
    stub({ AI_PROVIDER: provider });
    expect(aiProviderStatus()).toEqual({ provider, model, configured: false, missing: [key] });
    stub({ [key]: 'secret' });
    expect(aiProviderStatus()).toEqual({ provider, model, configured: true, missing: [] });
  });

  it('azure needs resource, key and a deployment name', () => {
    stub({ AI_PROVIDER: 'azure' });
    expect(aiProviderStatus()).toEqual({
      provider: 'azure', model: null, configured: false,
      missing: ['AZURE_RESOURCE_NAME', 'AZURE_API_KEY', 'AI_MODEL'],
    });
    stub({ AZURE_RESOURCE_NAME: 'acme-openai', AZURE_API_KEY: 'k', AI_MODEL: 'gpt-5-prod' });
    expect(aiProviderStatus()).toEqual({ provider: 'azure', model: 'gpt-5-prod', configured: true, missing: [] });
  });

  it('bedrock needs a region and either access keys or a bearer token', () => {
    stub({ AI_PROVIDER: 'bedrock' });
    expect(aiProviderStatus()).toEqual({
      provider: 'bedrock', model: 'us.anthropic.claude-opus-5-5', configured: false,
      missing: ['AWS_REGION', 'AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY or AWS_BEARER_TOKEN_BEDROCK'],
    });
    stub({ AWS_REGION: 'us-east-1', AWS_ACCESS_KEY_ID: 'AKIA' });
    expect(aiProviderStatus().missing).toEqual(['AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY or AWS_BEARER_TOKEN_BEDROCK']);
    stub({ AWS_SECRET_ACCESS_KEY: 's' });
    expect(aiProviderStatus()).toMatchObject({ configured: true, missing: [] });
  });

  it('bedrock accepts a bearer token instead of access keys', () => {
    stub({ AI_PROVIDER: 'bedrock', AWS_REGION: 'eu-central-1', AWS_BEARER_TOKEN_BEDROCK: 't', AI_MODEL: 'eu.anthropic.claude-opus-5-5' });
    expect(aiProviderStatus()).toEqual({
      provider: 'bedrock', model: 'eu.anthropic.claude-opus-5-5', configured: true, missing: [],
    });
  });

  it('openai-compatible needs a base URL and model, but no API key', () => {
    stub({ AI_PROVIDER: 'openai-compatible' });
    expect(aiProviderStatus()).toEqual({
      provider: 'openai-compatible', model: null, configured: false, missing: ['AI_BASE_URL', 'AI_MODEL'],
    });
    stub({ AI_BASE_URL: 'http://localhost:11434/v1', AI_MODEL: 'qwen3:8b' });
    expect(aiProviderStatus()).toEqual({ provider: 'openai-compatible', model: 'qwen3:8b', configured: true, missing: [] });
  });

  it('treats blank values as missing', () => {
    stub({ AI_PROVIDER: 'openai', OPENAI_API_KEY: '   ' });
    expect(aiProviderStatus().missing).toEqual(['OPENAI_API_KEY']);
  });

  it('flags an unknown provider', () => {
    stub({ AI_PROVIDER: 'mystery' });
    const status = aiProviderStatus();
    expect(status.configured).toBe(false);
    expect(status.missing[0]).toMatch(/^AI_PROVIDER \(one of: .*openai-compatible/);
  });
});

describe('modelFor', () => {
  it('builds the new providers without network access', () => {
    stub({ AI_BASE_URL: 'http://localhost:11434/v1' });
    expect(modelFor('azure', 'my-deployment').label).toBe('azure/my-deployment');
    expect(modelFor('bedrock').label).toBe('bedrock/us.anthropic.claude-opus-5-5');
    expect(modelFor('openai-compatible', 'llama3.1').label).toBe('openai-compatible/llama3.1');
  });

  it('requires a model name where there is no default', () => {
    expect(() => modelFor('azure')).toThrow(/needs AI_MODEL/);
    expect(() => modelFor('openai-compatible', 'llama3.1')).toThrow(/needs AI_BASE_URL/);
    expect(() => modelFor('mystery')).toThrow(/Unknown provider/);
  });
});
