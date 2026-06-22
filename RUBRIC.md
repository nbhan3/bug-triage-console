# Triage Rubric

Salient runs AI voice agents for compliant consumer lending and auto-finance
servicing — collections, payments, due-date changes, payoffs, disputes — under FDCPA,
FCRA, UDAAP, CFPB, and TCPA. Regulatory and financial exposure is therefore a
first-class input to triage, not an afterthought.

This document is the rubric in prose. The same rubric lives as tunable data in
[`src/lib/rules.ts`](src/lib/rules.ts); the engine in
[`src/lib/triage.ts`](src/lib/triage.ts) only applies it. Everything is a
case-insensitive substring match against a lexicon — no model, no network — so every
recommendation is reproducible and auditable.

## Routing philosophy: classify by root-cause *layer*, not symptom

A voice call passes through a pipeline: telephony/infra → speech-to-text → the
LLM/conversation policy → text-to-speech → post-call processing. The same surface
symptom can originate in different layers, and the layer is what determines **who owns
the fix**. So we classify by the layer where the root cause lives, not by what the
customer happened to notice.

That is why the precedence rules exist. "The agent said the wrong amount" sounds like a
TTS/pronunciation bug, but if the agent *reasoned* its way to the wrong number it is an
LLM problem. "Account lookup failed" sounds infrastructural, but if the agent simply
refused to check, it is a conversation-policy problem. We resolve those collisions
deliberately rather than by keyword count.

## The five buckets

| Bucket | Owner | Root-cause layer |
|---|---|---|
| **STT** (speech-to-text) | Voice AI | The agent mis-recognized the caller's words. Transcripts, `[inaudible]`, accents/languages, recognition mappings. |
| **TTS** (text-to-speech) | Voice AI | The agent's **output audio** is wrong: robotic/garbled voice, mispronunciation, cut-offs, broken barge-in, slow speech. |
| **LLM / Conversation** | LLM / Conversation | The agent reasoned, decided, or spoke wrongly: wrong intent, hallucination, loops, refusals, threats, tool/lookup misuse. Usually **prompt/policy-driven, so systemic**. |
| **Post-call process** | Integrations / Post-call | The call succeeded but downstream did not: missing/duplicate CRM writes, summaries, dispositions, QA labels, webhook delivery. |
| **Infrastructure** | Platform / Infra | Transport/platform failed: 5xx, endpoint/DB errors, telephony/carrier, storage, recording retrieval, auth, rate limits, outages. |

Each bucket has a signal lexicon. A bucket's score is the count of **distinct** signals
it matches; every matched span is recorded as evidence.

### Precedence / tie-break (applied before picking the primary bucket)

These encode the "root cause, not symptom" rule for the cases where layers collide:

1. **Explicit transport/HTTP/storage failure → Infrastructure wins over Post-call.** A
   `500` on `/webhook/call-ended` is an Infra failure, not a post-call logic bug.
2. **Output-audio symptom → TTS wins over STT.** "robotic", "garbled", "mispronounced",
   "reads the amount", "cuts off", "barge-in", "slow to speak".
3. **"Audio is fine" but transcript is wrong → STT wins** (TTS/Infra suppressed). The
   caller's words were clear; recognition failed.
4. **Language/accent → STT primary, LLM secondary.** e.g. the agent keeps answering in
   English to a Spanish caller: recognition is the root cause, conversation handling is
   a contributing factor.
5. **Reasoning/tool failures → LLM, not Infra**, even when "account lookup" sounds
   infrastructural. If the agent *insists* or *won't check*, that is policy.
6. **Otherwise**: highest score wins; ties break by priority Infra → LLM → TTS → STT →
   Post-call, and a tie caps confidence at Medium.

Any other bucket whose signals also fired is attached as a **secondary tag**.

## Severity model (Sev0 worst → Sev3 least; lower number = more severe)

1. **Base from blast radius (the Impact dropdown):** `outage` → Sev0, `many` → Sev1,
   `single` → Sev2.
2. **Frequency adjusters.** Clearly intermittent reports with a workaround
   ("sometimes", "intermittent", "occasionally", "workaround") **de-escalate** one step.
   Strong always-on cues ("every call", "always") can **escalate** one step.
   *Calibration note:* loose repetition words like "keeps" / "loop" / "half the call"
   are captured as evidence but are **not** auto-escalators — the Impact dropdown already
   encodes blast radius, and stacking a raise on top of it over-states single/many-caller
   reports.
3. **Exposure floors (see below)** can only raise severity, never lower it.
4. **Systemic-scope override.** If the primary bucket is STT/TTS/LLM, impact is a single
   caller, **but** the root cause is clearly prompt/policy/config-driven (the agent
   *said* something, a pronunciation rule, a recognition mapping), the real blast radius
   is systemic across calls — so a single-caller report gets at least a **Sev1** floor
   and the reason says so.
5. **Final severity = the most severe** of the adjusted base, every exposure floor, and
   the systemic floor.
6. Every result carries a one-line **severity reason**, e.g. *"Single-caller report, but
   a false legal threat is prompt-driven and systemic across calls: Sev0."*

## The compliance / financial exposure axis (orthogonal to buckets)

Exposure tags are detected independently of the technical bucket. They do two things:
set a **severity floor**, and open a **parallel Compliance / Risk route** alongside the
technical owner. A bug can be technically minor but legally severe — that combination is
exactly what this axis is for.

| Exposure tag | Floor | Why |
|---|---|---|
| **compliance-threat** | **Sev0** | A false/illegal threat ("arrested", "lawsuit", "garnish", "legal action") is a per-se FDCPA violation. Because it lives in the prompt, it is systemic across calls. |
| **compliance-misrep** | **Sev1** | Misrepresentation or disclosure/consent problems ("already paid" but the agent "insists" / "won't check", wrong amount, missing/incorrect disclosure). |
| **financial** | **Sev1** | Customer money is involved: amounts, payments, charges, transactions, refunds, double-logging, collections. |
| **data-loss / audit** | **Sev1**, → **Sev0** if widespread | Missing summaries/notes, unsaved records, lost or unretrievable recordings — an audit gap. Escalates to Sev0 when the text shows breadth ("many", "nothing", "across", "500", "near zero"). |

Whenever any exposure tag fires, routing adds the **Compliance / Risk** lane in parallel
with the technical owner, and the item is flagged urgent if it is Sev0 or Sev1.

## Confidence

- **High** — the top bucket clearly dominates (margin ≥ 2 distinct signals) and there are
  ≥ 2 total signals.
- **Low** — the margin is 0, there is ≤ 1 signal, the report is very short/vague, or the
  primary came down to a tie.
- **Medium** — everything else.

When confidence is Low, the recommended next questions lead with a disambiguating
question naming the competing root-cause layers.

## Why this is safe and auditable

- **Auditable.** Every recommendation shows the matched evidence spans (bucket signal vs
  exposure cue) and a plain-language severity reason. Every human override records the
  original vs new bucket/severity, a required note, and a timestamp.
- **Safe.** Triage produces a recommendation only. An item enters the queue on **Save**
  and is routed only on the explicit **Confirm & Route** action — never automatically.
- **Not "the model just knows."** The whole engine is the lexicon in `rules.ts` plus the
  pure function in `triage.ts`. There is no model call anywhere, and the 15-row
  acceptance test in `triage.test.ts` pins the behavior.
