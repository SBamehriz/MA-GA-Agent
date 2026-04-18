/**
 * Probe the local qwen3:8b endpoint and run a one-line generation.
 * Exit codes:
 *   0  endpoint reachable AND model present AND completion non-empty
 *   1  endpoint reachable but model not pulled
 *   2  endpoint not reachable / timed out
 *   3  any other failure
 *
 * Run:
 *   pnpm check:model
 *   # or directly:
 *   npx tsx scripts/check-local-model.ts
 */

import {
  generate,
  LocalModelError,
  probe,
  readLocalModelConfig,
} from "../packages/ai/local-model";

// The probe uses a generous token budget so qwen3 can finish its reasoning
// trace and still emit the one-word answer. Some qwen3 builds shipped via
// Ollama ignore `/no_think`, so the reliable knob is `maxTokens`.
// See docs/SETUP_MODEL.md for details.
const SAMPLE_PROMPT = "Reply with the single word READY and nothing else.";

async function main(): Promise<number> {
  const config = readLocalModelConfig();
  printHeader(config.endpoint, config.model);

  let probeResult: Awaited<ReturnType<typeof probe>>;
  try {
    probeResult = await probe();
  } catch (err) {
    return printError(err, { reachableExitCode: 1, unreachableExitCode: 2 });
  }

  process.stdout.write(`endpoint reachable:  yes (at ${probeResult.reachedAt})\n`);
  process.stdout.write(`installed models:    ${probeResult.installedModels.length}\n`);
  if (probeResult.installedModels.length > 0) {
    for (const name of probeResult.installedModels) {
      const marker = name === probeResult.model ? "  *" : "   ";
      process.stdout.write(`${marker} ${name}\n`);
    }
  }

  if (!probeResult.modelInstalled) {
    process.stderr.write(`\nFAIL: model '${probeResult.model}' is not pulled on this Ollama instance.\n`);
    process.stderr.write(`Hint: run \`ollama pull ${probeResult.model}\` and try again.\n`);
    return 1;
  }

  process.stdout.write(`\nmodel '${probeResult.model}' is present. Sending a tiny test prompt...\n`);

  try {
    const result = await generate({
      prompt: SAMPLE_PROMPT,
      temperature: 0,
      maxTokens: 2048,
    });
    process.stdout.write(`response (${result.durationMs}ms): "${result.text.replace(/\s+/g, " ").trim()}"\n`);
    if (result.thinking !== null) {
      process.stdout.write(`thinking:           ${result.thinking.length} chars (hidden)\n`);
    }
    if (result.completionTokens !== null) {
      process.stdout.write(`tokens: prompt=${result.promptTokens ?? "?"} completion=${result.completionTokens}\n`);
    }
    process.stdout.write("\nOK: local model is configured correctly.\n");
    return 0;
  } catch (err) {
    return printError(err, { reachableExitCode: 1, unreachableExitCode: 2 });
  }
}

function printHeader(endpoint: string, model: string): void {
  process.stdout.write("\n=== local model check ===\n");
  process.stdout.write(`endpoint:  ${endpoint}\n`);
  process.stdout.write(`model:     ${model}\n\n`);
}

function printError(
  err: unknown,
  exitCodes: { reachableExitCode: number; unreachableExitCode: number },
): number {
  if (err instanceof LocalModelError) {
    process.stderr.write(`\nFAIL [${err.code}]: ${err.message}\n`);
    process.stderr.write(`Hint: ${err.hint}\n`);
    if (err.code === "endpoint_unreachable" || err.code === "request_timeout") {
      return exitCodes.unreachableExitCode;
    }
    return exitCodes.reachableExitCode;
  }
  process.stderr.write(`\nFAIL: ${err instanceof Error ? err.message : String(err)}\n`);
  return 3;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    process.stderr.write(`\nUNEXPECTED: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(3);
  });
