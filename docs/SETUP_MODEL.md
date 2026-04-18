# Setting up the local model (qwen3:8b)

This system uses **one** local AI model: `qwen3:8b`, served by **Ollama** on your own machine. Nothing is sent to OpenAI, Anthropic, Google, or any cloud provider.

This page walks you through installing Ollama, pulling the model, and verifying it works. If you only want the commands, jump to the [Quick recipe](#quick-recipe).

---

## Why this model

- **Local.** Your resume, draft essays, and notes never leave your laptop.
- **Free.** No API key, no per-token cost.
- **Single model.** This project intentionally does not support multiple providers; that complexity is not worth it for one user.
- **qwen3:8b** is a strong general-purpose 8B model that runs on a 16 GB-RAM laptop (slow on CPU, comfortable on Apple Silicon or any modern GPU).

---

## What you need

- A computer with at least **16 GB of RAM** (24 GB or more is much more comfortable).
- About **6 GB of free disk space** for the model weights.
- One of:
  - macOS 12+
  - Linux (any modern distro)
  - Windows 10/11 with WSL2 *or* native Ollama for Windows

---

## Step 1 — Install Ollama

Pick the matching one. You only do this once.

### macOS
```bash
brew install ollama
```
Or download the `.dmg` from <https://ollama.com/download>.

### Linux
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

### Windows (native)
Download the installer from <https://ollama.com/download> and run it. Ollama installs as a background service and listens on `http://localhost:11434` automatically.

### Windows (WSL2 / Linux-in-Windows)
Same as Linux:
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

---

## Step 2 — Start the Ollama server

This is the process that actually answers requests.

- **Windows native:** Ollama runs in the background after install. You usually do not need to do anything.
- **macOS / Linux / WSL:** open a terminal and run:
  ```bash
  ollama serve
  ```
  Leave that terminal open. Open a second terminal for everything else.

You can confirm it is up by visiting <http://localhost:11434> in a browser. You should see the text `Ollama is running`.

---

## Step 3 — Pull the model

In a new terminal:

```bash
ollama pull qwen3:8b
```

This downloads about 5–6 GB. It only happens once. When it finishes, run:

```bash
ollama list
```

You should see a row that starts with `qwen3:8b`.

---

## Step 4 — Verify with the project's probe

From this repository's root:

```bash
pnpm check:model
```

A healthy run looks like this:

```
=== local model check ===
endpoint:  http://localhost:11434
model:     qwen3:8b

endpoint reachable:  yes (at 2026-04-18T08:00:00.000Z)
installed models:    1
  * qwen3:8b

model 'qwen3:8b' is present. Sending a tiny test prompt...
response (1453ms): "READY"
tokens: prompt=12 completion=2

OK: local model is configured correctly.
```

If the output starts with `FAIL`, see [Troubleshooting](#troubleshooting).

---

## Quick recipe

```bash
# Once
brew install ollama                  # or use the platform installer
ollama serve                         # in one terminal, leave it open
ollama pull qwen3:8b                 # in another terminal

# Verify
pnpm check:model
```

That is the entire setup.

---

## Configuration

The client reads three optional environment variables. Copy `.env.example` to `.env` if you want to override anything.

| Variable | Default | When to change it |
| --- | --- | --- |
| `LOCAL_MODEL_ENDPOINT` | `http://localhost:11434` | You moved Ollama to another port, or you are tunneling to another machine. |
| `LOCAL_MODEL_NAME` | `qwen3:8b` | You pulled a different tag and you really need to use it. The rest of the project assumes `qwen3:8b`. |
| `LOCAL_MODEL_TIMEOUT_MS` | `120000` | You are on CPU only and a single response takes longer than 2 minutes. |

Set them in `.env` like this:

```dotenv
LOCAL_MODEL_ENDPOINT=http://localhost:11434
LOCAL_MODEL_NAME=qwen3:8b
LOCAL_MODEL_TIMEOUT_MS=240000
```

---

## Troubleshooting

The probe (`pnpm check:model`) is designed to print the *exact* next thing to try. Read its `Hint:` line first. The cases below are the common ones.

### `FAIL [endpoint_unreachable]: Could not reach local model endpoint at http://localhost:11434`

Ollama is not running, or it is running on a different port.

1. Open a terminal and run `ollama serve`. Leave it open.
2. Open another terminal and re-run `pnpm check:model`.
3. If you intentionally moved Ollama to a different port, update `.env`:
   ```dotenv
   LOCAL_MODEL_ENDPOINT=http://localhost:YOUR_PORT
   ```

### `FAIL [model_not_found]: Model 'qwen3:8b' not available`

Ollama is running but the model has not been downloaded yet.

```bash
ollama pull qwen3:8b
pnpm check:model
```

If `ollama list` shows the model but the probe still complains, double-check the tag spelling in `LOCAL_MODEL_NAME`.

### `FAIL [request_timeout]: Local model did not respond within 120000ms`

The model is loading or running very slowly. This usually means CPU-only inference on a long prompt.

1. Bump the timeout to 4 minutes:
   ```dotenv
   LOCAL_MODEL_TIMEOUT_MS=240000
   ```
2. Re-run.
3. If even short prompts time out, restart Ollama: `ollama serve` again.

### `FAIL [http_error]: Local model HTTP 500 ...`

Ollama is alive but something inside it failed (out of memory is the usual cause).

1. Close other heavy apps (browsers with many tabs, IDEs, video calls).
2. Restart Ollama.
3. If it still fails, try a smaller test (`ollama run qwen3:8b` interactively and type `hi`). If that also fails, your machine likely cannot run the 8B model on CPU; consider a smaller `qwen3:1.7b` for testing while you sort out hardware. **Do not change** `LOCAL_MODEL_NAME` for real runs — the rest of the project is tuned for `qwen3:8b`.

### `FAIL [empty_response]: ...thinking trace but no visible answer` / `...hit num_predict while still thinking`

This is qwen3-specific. `qwen3:8b` is a "thinking" model: it emits a reasoning trace first, then its actual answer. If `maxTokens` is too small, the model runs out of tokens *inside* the thinking trace and never reaches the answer.

The reliable fix is **give it more tokens**. Pass `maxTokens: 2048` (or higher) when calling `generate(...)`. The probe already uses a 2048-token budget.

Some builds of qwen3 also support a `/no_think` directive appended to the prompt that tells the model to skip reasoning entirely:

```
Reply with the single word READY and nothing else. /no_think
```

This is **best-effort**. Several qwen3 tags shipped through Ollama ignore `/no_think` and still emit a reasoning trace (just via Ollama's dedicated `thinking` response field instead of inline `<think>` tags). If `/no_think` doesn't shorten the response, fall back to `maxTokens`.

In either case, the client exposes the reasoning trace separately on `result.thinking` and the answer on `result.text`, so downstream code never has to parse the two apart.

### `FAIL [empty_response]: Local model returned an empty completion`

Rare. The model loaded but produced no text at all (no answer *and* no thinking trace).

- Restart Ollama.
- Reduce the timeout pressure by closing other apps.
- Re-run.

### `FAIL [invalid_response]: Local model returned a non-JSON body`

You are pointing the client at something that is *not* an Ollama-compatible server. See the next section.

---

## Using a non-Ollama server (advanced)

This client speaks the **Ollama HTTP API** (`POST /api/generate`, `GET /api/tags`). If your local model is exposed differently, you have two clean options. **Pick one** and do not try to mix them.

### Option A — Run Ollama as well (recommended)

Even if you also run LM Studio or llama.cpp, install Ollama and pull `qwen3:8b` into it. The two servers can coexist on different ports. This keeps the project's client simple and avoids a custom integration.

### Option B — Put a tiny proxy in front of your server

If you really must use an OpenAI-compatible server (LM Studio, llama.cpp `server`, vLLM):

1. Run that server normally on, say, `http://localhost:1234/v1/chat/completions`.
2. Write a ~30-line proxy that exposes `POST /api/generate` and `GET /api/tags` and forwards to your real server. Translate the request/response shape between Ollama (`{ model, prompt, options, stream }` → `{ response, prompt_eval_count, eval_count }`) and OpenAI chat completions (`{ model, messages, ... }` → `{ choices: [{ message: { content }}], usage }`).
3. Point `LOCAL_MODEL_ENDPOINT` at the proxy.

This project intentionally does **not** ship an OpenAI-compatible adapter — adding one would re-create the multi-provider sprawl this block was meant to prevent.

### Option C — CLI-only (`ollama run qwen3:8b`)

Useful if you want to chat with the model directly from a terminal without involving this project's pipeline. The project's code paths still expect the HTTP API, so for actual workflow runs you need Ollama's server (`ollama serve`) running.

---

## Sanity checklist

Before you run the project's flows, confirm all three:

- [ ] `ollama serve` is running (or Ollama is running as a Windows service).
- [ ] `ollama list` shows `qwen3:8b`.
- [ ] `pnpm check:model` ends with `OK: local model is configured correctly.`

Once that passes, head back to the [`RUNBOOK`](RUNBOOK.md) or the [non-technical guide](NON_TECHNICAL_GUIDE.md) and run the workflows.
