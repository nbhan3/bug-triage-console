// server/index.ts — Tiny Express backend.
//
// Exposes POST /api/classify: runs the bug report through Claude and returns
// { available, bucket, reason }.  Returns { available: false } immediately if
// ANTHROPIC_API_KEY is not set — the front-end falls back to rules-only mode.
//
// Environment variables (all optional; use a .env file in the repo root):
//   ANTHROPIC_API_KEY   — your Anthropic key
//   MODEL               — defaults to claude-sonnet-4-6
//   API_PORT            — defaults to 3001

import "dotenv/config";
import express from "express";
import Anthropic from "@anthropic-ai/sdk";

const PORT = Number(process.env.API_PORT ?? 3001);
const MODEL = process.env.MODEL ?? "claude-sonnet-4-6";

const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;

const VALID_BUCKETS = new Set(["STT", "TTS", "LLM", "Post-call", "Infrastructure"]);

const app = express();
app.use(express.json());

// Health check — also lets the client know whether LLM mode is active.
app.get("/api/status", (_req, res) => {
  res.json({ llmEnabled: !!anthropic, model: anthropic ? MODEL : null });
});

app.post("/api/classify", async (req, res) => {
  // No API key → signal rules-only mode; front-end handles this gracefully.
  if (!anthropic) {
    res.json({ available: false });
    return;
  }

  const { bugReport, impact } = req.body as { bugReport?: string; impact?: string };

  if (!bugReport?.trim()) {
    res.status(400).json({ error: "bugReport is required" });
    return;
  }

  const prompt = `You are a triage expert for an AI voice agent that services auto-loan borrowers over the phone.

Classify this bug report into exactly ONE of these five root-cause buckets:
  STT          – speech-to-text recognition errors, transcription failures, diarization, accent/language problems
  TTS          – text-to-speech voice quality, pronunciation (numbers, amounts), output latency, barge-in/interruptions
  LLM          – wrong intent, hallucination, refusal, looping, policy violations, bad account lookup, tool misuse, wrong reasoning
  Post-call    – post-call summaries, CRM writes, disposition codes, call notes, webhook delivery after the call ends
  Infrastructure – dialing/connect issues, call drops, recording storage, database writes, webhooks down, auth, rate limits, outages

Bug report: ${JSON.stringify(bugReport.trim())}
Impact: ${impact ?? "unknown"}

Important: classify by ROOT CAUSE, not symptom.
  • Audio fine but transcript wrong → STT (not TTS)
  • Agent reasons incorrectly about account data → LLM (not Post-call)
  • Writes to Salesforce fail after the call → Post-call (not Infra)
  • Calls can't connect or drop → Infrastructure

Respond with JSON only — absolutely no text before or after the JSON object:
{"bucket":"<STT|TTS|LLM|Post-call|Infrastructure>","reason":"<one concise sentence explaining the root cause>"}`;

  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
    });

    const raw =
      message.content[0].type === "text" ? message.content[0].text.trim() : "";

    // Strip optional markdown fences (model sometimes wraps in ```json ... ```)
    const jsonStr = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();

    const parsed = JSON.parse(jsonStr) as { bucket: string; reason: string };

    if (!VALID_BUCKETS.has(parsed.bucket)) {
      throw new Error(`LLM returned invalid bucket: ${parsed.bucket}`);
    }

    res.json({ available: true, bucket: parsed.bucket, reason: parsed.reason });
  } catch (err) {
    console.error("[/api/classify] error:", err);
    res.status(500).json({ available: false, error: String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`\nAPI server → http://localhost:${PORT}`);
  console.log(
    anthropic
      ? `LLM mode  → model = ${MODEL}`
      : "Rules-only mode (add ANTHROPIC_API_KEY to .env to enable LLM layer)",
  );
});
