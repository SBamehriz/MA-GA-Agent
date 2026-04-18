# `@ma-ga-agent/ai`

Single-model local client. ONE model only: **`qwen3:8b`** via an Ollama HTTP endpoint.

This package deliberately has no provider abstraction, no streaming, no fallbacks, and no multi-model routing. It exists so the rest of the system can call a local LLM in *exactly one* place.

## What it gives you

- `generate({ prompt, system?, temperature?, maxTokens? })` — prompt → text
- `probe()` — verifies the endpoint is reachable and the model is pulled
- `LocalModelError` — typed errors with an actionable `hint` field
- `readLocalModelConfig()` — reads `LOCAL_MODEL_ENDPOINT`, `LOCAL_MODEL_NAME`, `LOCAL_MODEL_TIMEOUT_MS` from `process.env`

## What it does NOT do

- It does **not** call OpenAI, Anthropic, Gemini, or any hosted provider.
- It does **not** swap models based on task.
- It does **not** silently fall back when the endpoint is down — every failure throws `LocalModelError` with `hint`.
- It does **not** rewrite or replace the deterministic grounding pipeline in `packages/writing/`. Grounding stays deterministic; this client is only a drafting/polish helper that callers can opt into.

## Configuration

Two environment variables (both optional, both have safe defaults):

| Variable | Default | Notes |
| --- | --- | --- |
| `LOCAL_MODEL_ENDPOINT` | `http://localhost:11434` | Base URL of your Ollama (or Ollama-compatible) server. No trailing slash needed. |
| `LOCAL_MODEL_NAME` | `qwen3:8b` | Tag of the pulled model. |
| `LOCAL_MODEL_TIMEOUT_MS` | `120000` | Per-request timeout. Bump it if you are CPU-only. |

See `docs/SETUP_MODEL.md` for the full setup walkthrough.

## Example

```ts
import { generate, LocalModelError } from "@ma-ga-agent/ai";

try {
  const result = await generate({
    prompt: "Rewrite this sentence to sound less stiff:\n\nI did the thing.",
    temperature: 0.4,
    maxTokens: 1024,
  });
  console.log(result.text);
  console.log(`(${result.durationMs}ms, ${result.completionTokens ?? "?"} tokens)`);
} catch (err) {
  if (err instanceof LocalModelError) {
    console.error(`[${err.code}] ${err.message}`);
    console.error(`Hint: ${err.hint}`);
    process.exit(1);
  }
  throw err;
}
```

## Note on qwen3's thinking mode

`qwen3:8b` is a "thinking" model. It emits a reasoning trace first, then the actual answer. Ollama surfaces the trace in two different ways depending on version:

- a dedicated top-level `thinking` field on the `/api/generate` response (newer), or
- inline `<think>...</think>` blocks inside `response` (older / generic servers).

The client merges both and exposes them separately:

- `result.text` — the user-facing answer (think block stripped, native `thinking` field removed).
- `result.thinking` — the reasoning trace if present, else `null`.
- `result.rawText` — the raw `response` string exactly as returned by the server.

Two consequences:

1. **Give thinking room.** Use `maxTokens: 2048` or higher for any non-trivial prompt. If qwen3 runs out of tokens *inside* the reasoning trace, you get `LocalModelError` with code `empty_response` and a hint pointing here.
2. **The `/no_think` directive is best-effort.** Some qwen3 builds shipped through Ollama ignore it. The reliable knob is `maxTokens`.

## Where this is allowed to be called

The grounding rules in [`CLAUDE.md`](../../CLAUDE.md) §5.1 and §8 still apply. Specifically, this client **may** be used for:

- Personalising the *wording* of an existing `Claim` whose `refs[]` already resolve.
- Drafting a critic note about tone/clarity (the deterministic critic stays the source of truth for blocking decisions).
- Suggesting a rewrite of a sentence the user is editing.

It **must not** be used to:

- Invent a new fact, achievement, metric, project, or relationship that has no `evidence_id[]`.
- Replace the deterministic grounding check in `packages/writing/grounding.ts`.
- Auto-decide an approval, auto-send an email, or auto-fill a portal field.

If you are not sure whether your use case is allowed, ask in the PR before wiring it in.
