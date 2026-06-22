# Bug Triage Console

An internal tool for Salient's Customer Success + Engineering teams. It takes one
free-text bug report about the production voice agent and returns a recommended
**bucket**, **severity**, **confidence**, **evidence**, **routing**, and **next
questions** — so CS and Eng converge fast.

Classification is always a **recommendation**, never an autonomous action. Nothing
is routed until a human clicks **Confirm & Route**.

## What it is (and is not)

- **Deterministic.** All triage is a rules engine in TypeScript
  ([`src/lib/rules.ts`](src/lib/rules.ts) + [`src/lib/triage.ts`](src/lib/triage.ts)).
- **No network, no LLM, no API keys** at runtime. Not "the model just knows" — every
  output is a substring match against an editable lexicon, so it is reproducible and
  auditable.
- **Client-only.** No backend, no server routes. The triage queue and the override /
  audit log live in `localStorage`.

## Run locally

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

Other scripts:

```bash
npm test
npm run typecheck
npm run build
npm run preview
```

- `npm test` — runs the acceptance suite (15 seeds → expected bucket + severity)
- `npm run typecheck` — full TypeScript check
- `npm run build` — static client build into `dist/`
- `npm run preview` — serve the production build locally

> Tip: don't paste a command with a trailing `# comment` into zsh — interactive zsh
> does not treat `#` as a comment by default and will pass it to the program as an
> argument.

## Deploy to Vercel (zero config)

This is a static Vite client build, so Vercel needs no configuration.

1. Push this repo to GitHub.
2. In Vercel, **Add New → Project** and import the repo.
3. Vercel auto-detects Vite: **Build command** `npm run build`, **Output directory**
   `dist`. Accept the defaults and **Deploy**.

Or from the CLI:

```bash
npm i -g vercel
vercel        # follow prompts; accept the detected Vite settings
vercel --prod
```

> Note: `npm run build` runs `vite build` only (esbuild strips types), so a stray type
> warning never blocks a deploy. Run `npm run typecheck` for full type checking in CI.

## Using it

1. Paste a report into **Bug report** (or pick one of the 15 examples from **Load
   example…**), set **Impact**, and click **Triage report** (or ⌘/Ctrl+Enter).
2. Review the recommendation: severity badge, bucket + secondary tags, confidence, the
   one-line severity reason, the original report with **evidence spans highlighted**,
   the routing block (owner, parallel Compliance / Risk lane, urgent flag, "check
   first"), and the next questions.
3. Optionally **override** the bucket/severity — a "why changed" note is required, and
   the change is recorded (original → new, note, timestamp) in the item's audit log.
4. **Save to queue** (status New) or **Confirm & Route** (status Routed). Routing is the
   explicit, deliberate action; triage alone never routes.
5. Work the **queue** below: filter by bucket / severity / status, search by customer,
   advance status (New → In Review → Routed → Resolved), reopen any row for full detail
   and override history, and **Export** the queue as JSON or CSV.

## Layout of the code

```
src/
  lib/
    rules.ts        # editable lexicons + config — the rubric, as data (no logic)
    triage.ts       # pure deterministic engine: triage(input) -> TriageResult
    triage.test.ts  # asserts the 15 seeds produce the expected bucket + severity
    seeds.ts        # the 15 sample reports as form inputs (inputs only)
    storage.ts      # localStorage load/save + types for the queue and audit log
    display.ts      # presentation helpers (colors, labels) shared by components
  components/        # InputForm, ResultCard, EvidenceText, TriageQueue, OverrideEditor, StatBar
  App.tsx
```

See [`RUBRIC.md`](RUBRIC.md) for the bucket definitions, the severity model, the
compliance / financial exposure axis, and the routing philosophy.
