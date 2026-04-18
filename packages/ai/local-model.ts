/**
 * Local model client. ONE model only: qwen3:8b via a local Ollama-style HTTP endpoint.
 *
 * This file is intentionally minimal:
 *   - prompt -> text
 *   - no streaming
 *   - no provider abstraction
 *   - no fallbacks
 *
 * Configuration is read from two environment variables at call time:
 *   LOCAL_MODEL_ENDPOINT   default "http://localhost:11434"
 *   LOCAL_MODEL_NAME       default "qwen3:8b"
 *
 * Anything that goes wrong throws a typed error with an actionable hint.
 * Callers (and the `scripts/check-local-model.ts` probe) print `error.hint`
 * directly so a non-technical user gets a real next step instead of a stack trace.
 *
 * Endpoint shape: Ollama HTTP API.
 *   POST {endpoint}/api/generate     { model, prompt, system?, options, stream:false }
 *   GET  {endpoint}/api/tags         lists locally pulled models
 *
 * If the user is running an OpenAI-compatible server instead (llama.cpp / LM Studio /
 * vLLM), they should either run Ollama in front of qwen3:8b or wrap that server with a
 * tiny proxy that exposes /api/generate. See docs/SETUP_MODEL.md for both options.
 */

export const DEFAULT_LOCAL_MODEL_ENDPOINT = "http://localhost:11434";
export const DEFAULT_LOCAL_MODEL_NAME = "qwen3:8b";
export const DEFAULT_LOCAL_MODEL_TIMEOUT_MS = 120_000;

export interface LocalModelConfig {
  endpoint: string;
  model: string;
  timeoutMs: number;
}

export interface GenerateInput {
  prompt: string;
  system?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface GenerateOutput {
  /**
   * Final user-facing answer with any qwen3 `<think>...</think>` block stripped.
   * This is the value callers should normally use.
   */
  text: string;
  /**
   * The qwen3 reasoning trace if present. `null` when the model emitted no
   * `<think>` block, or when `/no_think` was used.
   */
  thinking: string | null;
  /**
   * Raw text exactly as returned by the model. Useful for debugging and for
   * callers that want to render `<think>` themselves.
   */
  rawText: string;
  model: string;
  endpoint: string;
  durationMs: number;
  promptTokens: number | null;
  completionTokens: number | null;
}

export type LocalModelErrorCode =
  | "endpoint_unreachable"
  | "model_not_found"
  | "request_timeout"
  | "http_error"
  | "empty_response"
  | "invalid_response";

export class LocalModelError extends Error {
  public readonly code: LocalModelErrorCode;
  public readonly endpoint: string;
  public readonly model: string;
  public readonly hint: string;

  constructor(args: {
    code: LocalModelErrorCode;
    message: string;
    endpoint: string;
    model: string;
    hint: string;
    cause?: unknown;
  }) {
    super(args.message, args.cause === undefined ? undefined : { cause: args.cause });
    this.name = "LocalModelError";
    this.code = args.code;
    this.endpoint = args.endpoint;
    this.model = args.model;
    this.hint = args.hint;
  }
}

export function readLocalModelConfig(env: NodeJS.ProcessEnv = process.env): LocalModelConfig {
  const endpointRaw = env.LOCAL_MODEL_ENDPOINT?.trim();
  const modelRaw = env.LOCAL_MODEL_NAME?.trim();
  const timeoutRaw = env.LOCAL_MODEL_TIMEOUT_MS?.trim();

  const endpoint = endpointRaw && endpointRaw.length > 0 ? endpointRaw : DEFAULT_LOCAL_MODEL_ENDPOINT;
  const model = modelRaw && modelRaw.length > 0 ? modelRaw : DEFAULT_LOCAL_MODEL_NAME;
  const timeoutParsed = timeoutRaw ? Number.parseInt(timeoutRaw, 10) : Number.NaN;
  const timeoutMs = Number.isFinite(timeoutParsed) && timeoutParsed > 0
    ? timeoutParsed
    : DEFAULT_LOCAL_MODEL_TIMEOUT_MS;

  return {
    endpoint: endpoint.replace(/\/+$/, ""),
    model,
    timeoutMs,
  };
}

/**
 * Send a single prompt to the local model and return the completion text.
 * Throws LocalModelError on every failure path. No silent fallbacks.
 */
export async function generate(
  input: GenerateInput,
  configOverride?: Partial<LocalModelConfig>,
): Promise<GenerateOutput> {
  const baseConfig = readLocalModelConfig();
  const config: LocalModelConfig = {
    endpoint: configOverride?.endpoint ?? baseConfig.endpoint,
    model: configOverride?.model ?? baseConfig.model,
    timeoutMs: configOverride?.timeoutMs ?? baseConfig.timeoutMs,
  };

  if (!input.prompt || input.prompt.trim().length === 0) {
    throw new LocalModelError({
      code: "invalid_response",
      message: "generate() called with an empty prompt",
      endpoint: config.endpoint,
      model: config.model,
      hint: "Pass a non-empty `prompt` string. Local-model calls cost real CPU/GPU time; we refuse empty prompts.",
    });
  }

  const url = `${config.endpoint}/api/generate`;
  const body = {
    model: config.model,
    prompt: input.prompt,
    ...(input.system !== undefined ? { system: input.system } : {}),
    stream: false,
    options: {
      ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
      ...(input.maxTokens !== undefined ? { num_predict: input.maxTokens } : {}),
    },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  const startedAt = Date.now();

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (cause) {
    const isAbort = cause instanceof Error && cause.name === "AbortError";
    if (isAbort) {
      throw new LocalModelError({
        code: "request_timeout",
        message: `Local model did not respond within ${config.timeoutMs}ms`,
        endpoint: config.endpoint,
        model: config.model,
        hint: `qwen3:8b can be slow on CPU. Increase LOCAL_MODEL_TIMEOUT_MS (currently ${config.timeoutMs}) or shorten the prompt.`,
        cause,
      });
    }
    throw new LocalModelError({
      code: "endpoint_unreachable",
      message: `Could not reach local model endpoint at ${config.endpoint}`,
      endpoint: config.endpoint,
      model: config.model,
      hint:
        "Is Ollama running? Try: `ollama serve` in another terminal, then `ollama list` to confirm qwen3:8b is pulled. " +
        "See docs/SETUP_MODEL.md.",
      cause,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const text = await safeReadText(response);
    if (response.status === 404 || /model.*not found|pull.*model/i.test(text)) {
      throw new LocalModelError({
        code: "model_not_found",
        message: `Model '${config.model}' not available at ${config.endpoint} (HTTP ${response.status})`,
        endpoint: config.endpoint,
        model: config.model,
        hint: `Pull it once with: \`ollama pull ${config.model}\`. Then re-run.`,
      });
    }
    throw new LocalModelError({
      code: "http_error",
      message: `Local model HTTP ${response.status}: ${truncate(text, 240)}`,
      endpoint: config.endpoint,
      model: config.model,
      hint: "See the message above. If this persists, restart Ollama (`ollama serve`) and re-run the probe (`pnpm check:model`).",
    });
  }

  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch (cause) {
    throw new LocalModelError({
      code: "invalid_response",
      message: "Local model returned a non-JSON body",
      endpoint: config.endpoint,
      model: config.model,
      hint: "If you are running an OpenAI-compatible server (LM Studio / llama.cpp), this client expects the Ollama /api/generate shape. See docs/SETUP_MODEL.md.",
      cause,
    });
  }

  const rawText = extractResponseText(parsed);
  if (rawText === null) {
    throw new LocalModelError({
      code: "invalid_response",
      message: "Local model response had no `response` field",
      endpoint: config.endpoint,
      model: config.model,
      hint: "This client expects the Ollama /api/generate response shape. See docs/SETUP_MODEL.md.",
    });
  }

  // Ollama ships thinking traces in two ways depending on version:
  //   (a) a dedicated top-level `thinking` field (newer)
  //   (b) `<think>...</think>` blocks embedded in `response`  (older / some models)
  // We merge both so callers see one consistent shape.
  const nativeThinking = extractNativeThinking(parsed);
  const split = splitThinking(rawText);
  const mergedThinking = mergeThinking(nativeThinking, split.thinking);
  const doneReason = extractStringField(parsed, "done_reason");

  if (split.text.length === 0) {
    const truncatedByLength = doneReason === "length";
    if (mergedThinking !== null && mergedThinking.length > 0) {
      const lengthHint = truncatedByLength
        ? `qwen3 ran out of tokens (${config.model} hit num_predict) inside its reasoning block. Raise \`maxTokens\` (try 2048+).`
        : `qwen3 produced a reasoning trace but no visible answer. Raise \`maxTokens\` (try 2048+) so the answer can be emitted after the trace.`;
      throw new LocalModelError({
        code: "empty_response",
        message: truncatedByLength
          ? "Local model hit num_predict while still thinking; no answer emitted"
          : "Local model produced a thinking trace but no visible answer",
        endpoint: config.endpoint,
        model: config.model,
        hint: lengthHint,
      });
    }
    throw new LocalModelError({
      code: "empty_response",
      message: "Local model returned an empty completion",
      endpoint: config.endpoint,
      model: config.model,
      hint: "The model loaded but produced no text. Try a shorter prompt, raise the timeout, or restart Ollama.",
    });
  }

  return {
    text: split.text,
    thinking: mergedThinking,
    rawText,
    model: config.model,
    endpoint: config.endpoint,
    durationMs: Date.now() - startedAt,
    promptTokens: extractIntField(parsed, "prompt_eval_count"),
    completionTokens: extractIntField(parsed, "eval_count"),
  };
}

function mergeThinking(nativeField: string | null, inlineParsed: string | null): string | null {
  const parts: string[] = [];
  if (nativeField && nativeField.length > 0) parts.push(nativeField);
  if (inlineParsed && inlineParsed.length > 0) parts.push(inlineParsed);
  if (parts.length === 0) return null;
  return parts.join("\n\n").trim();
}

export interface ProbeResult {
  ok: boolean;
  endpoint: string;
  model: string;
  installedModels: string[];
  modelInstalled: boolean;
  reachedAt: string;
}

/**
 * Lightweight readiness check. Hits /api/tags and verifies the configured model is present.
 * Used by `scripts/check-local-model.ts` to fail loudly with an actionable hint.
 */
export async function probe(configOverride?: Partial<LocalModelConfig>): Promise<ProbeResult> {
  const baseConfig = readLocalModelConfig();
  const config: LocalModelConfig = {
    endpoint: configOverride?.endpoint ?? baseConfig.endpoint,
    model: configOverride?.model ?? baseConfig.model,
    timeoutMs: configOverride?.timeoutMs ?? Math.min(baseConfig.timeoutMs, 10_000),
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  let response: Response;
  try {
    response = await fetch(`${config.endpoint}/api/tags`, { signal: controller.signal });
  } catch (cause) {
    const isAbort = cause instanceof Error && cause.name === "AbortError";
    throw new LocalModelError({
      code: isAbort ? "request_timeout" : "endpoint_unreachable",
      message: isAbort
        ? `Probe to ${config.endpoint} timed out after ${config.timeoutMs}ms`
        : `Probe could not reach ${config.endpoint}`,
      endpoint: config.endpoint,
      model: config.model,
      hint:
        "Start the local model server first: `ollama serve` (in another terminal). " +
        "If you changed the endpoint, set LOCAL_MODEL_ENDPOINT in .env. See docs/SETUP_MODEL.md.",
      cause,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new LocalModelError({
      code: "http_error",
      message: `Probe HTTP ${response.status} from ${config.endpoint}`,
      endpoint: config.endpoint,
      model: config.model,
      hint: "Endpoint answered but did not return a model list. Confirm it is Ollama (or an Ollama-compatible server).",
    });
  }

  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch (cause) {
    throw new LocalModelError({
      code: "invalid_response",
      message: "Probe got a non-JSON response from /api/tags",
      endpoint: config.endpoint,
      model: config.model,
      hint: "This client expects an Ollama-compatible endpoint. See docs/SETUP_MODEL.md for OpenAI-compat / CLI setups.",
      cause,
    });
  }

  const installedModels = extractInstalledModels(parsed);
  const modelInstalled = installedModels.some((name) => name === config.model);

  return {
    ok: modelInstalled,
    endpoint: config.endpoint,
    model: config.model,
    installedModels,
    modelInstalled,
    reachedAt: new Date().toISOString(),
  };
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

function extractResponseText(parsed: unknown): string | null {
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;
  const value = obj["response"];
  if (typeof value !== "string") return null;
  return value;
}

const THINK_BLOCK_RE = /<think>([\s\S]*?)<\/think>/gi;

/**
 * qwen3 emits an optional `<think>...</think>` reasoning block before its
 * actual answer. Strip it from the user-facing text but expose it separately.
 *
 * Handles three cases:
 *   1. Complete `<think>...</think>` block: strip and capture.
 *   2. No think block: return the original text trimmed, thinking=null.
 *   3. Truncated `<think>...` with no closing tag (qwen ran out of tokens
 *      mid-trace): treat the entire response as thinking, leave text empty
 *      so the caller fails loudly with an actionable hint.
 */
export function splitThinking(raw: string): { text: string; thinking: string | null } {
  if (!raw) return { text: "", thinking: null };

  const collected: string[] = [];
  const cleaned = raw.replace(THINK_BLOCK_RE, (_match, body: string) => {
    collected.push(body.trim());
    return "";
  });

  const text = cleaned.trim();
  let thinking: string | null = collected.length > 0 ? collected.join("\n\n").trim() : null;

  if (text.length === 0) {
    const openIdx = raw.indexOf("<think>");
    if (openIdx !== -1 && raw.indexOf("</think>", openIdx) === -1) {
      const truncatedThinking = raw.slice(openIdx + "<think>".length).trim();
      if (truncatedThinking.length > 0) {
        thinking = thinking ? `${thinking}\n\n${truncatedThinking}` : truncatedThinking;
      }
    }
  }

  return { text, thinking };
}

function extractIntField(parsed: unknown, key: string): number | null {
  if (!parsed || typeof parsed !== "object") return null;
  const value = (parsed as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function extractStringField(parsed: unknown, key: string): string | null {
  if (!parsed || typeof parsed !== "object") return null;
  const value = (parsed as Record<string, unknown>)[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function extractNativeThinking(parsed: unknown): string | null {
  if (!parsed || typeof parsed !== "object") return null;
  const value = (parsed as Record<string, unknown>)["thinking"];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function extractInstalledModels(parsed: unknown): string[] {
  if (!parsed || typeof parsed !== "object") return [];
  const list = (parsed as Record<string, unknown>)["models"];
  if (!Array.isArray(list)) return [];
  const out: string[] = [];
  for (const entry of list) {
    if (entry && typeof entry === "object") {
      const name = (entry as Record<string, unknown>)["name"];
      if (typeof name === "string" && name.length > 0) out.push(name);
    }
  }
  return out;
}
