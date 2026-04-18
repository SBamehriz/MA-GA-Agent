# A plain-language guide to MA-GA-Agent

This guide assumes you have **never written code** and have **never touched a terminal**. Everything is explained step by step.

If at any point you get lost, follow the rule of thumb: **read the error message, copy it into a search engine, and try again.** Most issues are common ones with one-line fixes.

---

## 1. What is this thing?

MA-GA-Agent is a personal helper that runs entirely **on your own laptop**. It helps you apply to Master's programs in AI (and related fields) and at the same time hunt for funding — Graduate Assistantships (GA), Teaching Assistantships (TA), Research Assistantships (RA), and similar — that reduce or cover your tuition.

It does five things:

1. **Onboarding** — reads your resume, transcript, and answers to a few questions, and builds a verified profile of you.
2. **Discovery** — finds candidate programs, finds funding opportunities, finds the right professors and coordinators, and stores everything with sources.
3. **Writing** — drafts SOPs, short answers, cover letters, outreach, and tailored resumes — strictly using facts from your verified profile and verified programs.
4. **Application prep** — for each program, builds a checklist of what is required and what is missing, and produces an "approval queue" of decisions you (the human) need to make.
5. **Approvals + persistence** — saves everything so you can come back tomorrow, decide what to approve, and pick up where you left off.

What it **does not** do (on purpose):

- It does **not submit** any application.
- It does **not pay** any application fee.
- It does **not send** emails to professors or recommenders.
- It does **not log into** any school portal.

Those are real-world side effects. They will require explicit clicks from you when (and if) those features are added later.

---

## 2. What you need before starting

A laptop with:

- macOS, Linux, or Windows 10/11.
- At least 16 GB of RAM (more is better).
- About 6 GB of free disk space for the AI model.
- An internet connection (only needed during the one-time setup).

You also need:

- A text version of your **resume**.
- A text version of your **transcript** (or a clear list of your courses and grades).
- 30–45 minutes of focused time to fill out your profile honestly.

Optional but very helpful:

- A short writing sample of your own (3–5 paragraphs). The system uses this as a "voice anchor" so the drafts sound like you.

---

## 3. One-time setup

You only do this once. Open a terminal (on macOS: `Terminal.app`; on Windows: `PowerShell`; on Linux: any terminal).

### a. Get the project

```bash
git clone <repo-url> ma-ga-agent
cd ma-ga-agent
pnpm install
```

If `pnpm` is not installed, install Node.js first (<https://nodejs.org>) then run:

```bash
npm install -g pnpm
```

### b. Install the local AI model

The system uses **one** model: `qwen3:8b`, served by **Ollama** on your laptop. Nothing leaves your machine.

```bash
brew install ollama        # on macOS
# or, on Linux / WSL:
curl -fsSL https://ollama.com/install.sh | sh
# on Windows: download from https://ollama.com/download
```

Start it (and leave the terminal window open):

```bash
ollama serve
```

In a **second** terminal, pull the model:

```bash
ollama pull qwen3:8b
```

This downloads about 6 GB. It takes a while. Get a coffee.

### c. Verify the model works

```bash
pnpm check:model
```

You want to see **`OK: local model is configured correctly.`** at the bottom. If you do not, read the `Hint:` line — it tells you exactly what to do — and look at [`SETUP_MODEL.md`](SETUP_MODEL.md) for the full troubleshooting guide.

That's it. You will never need to do this again unless you change machines.

---

## 4. Adding your information

The system reads your information from a single file:

```
fixtures/seeds/onboarding-sample.json
```

For your **first run, leave it alone**. It already contains a realistic sample student. This lets you see how everything works before you fill in your own data.

When you are ready to use the system for *yourself*:

1. Make a copy of that file (call it whatever you want, e.g. `me.json`).
2. Open it in any text editor (TextEdit, Notepad, VS Code — anything).
3. Replace the values with your own. The structure is documented inline; every field has a comment-like description in the surrounding text.
4. **Be honest.** Do not write that you led a project you only contributed to. Do not write a GPA you did not earn. The system uses what you write here as the *only* source of truth for everything it later generates. If it is wrong here, it will be wrong in your applications.

> The system will **block** any drafted essay, letter, or message that contains a fact it cannot trace back to this file or to your verified stories. That is by design. There is no "just trust me" path.

---

## 5. Running the workflows

Each workflow is one command. Run them in order, the first time, and read the output before moving on.

> If you are using your own JSON file from step 4, add its path: `pnpm run:onboarding fixtures/seeds/me.json`. Otherwise the default sample is used.

### Step 1 — Onboarding

```bash
pnpm run:onboarding
```

What this does:
- reads your profile, resume, and transcript;
- builds your "story bank" — about 30 short, verified vignettes drawn from your real experience;
- registers your "voice anchor" — a sample of your own writing the system will try to match;
- emits an `onboarding.complete` event.

Look at the printed summary. If anything looks wrong (your GPA, your university name, a project description), **fix the JSON file and re-run**. Do not move on with bad data.

### Step 2 — Discovery

```bash
pnpm run:research-sweep
```

What this does:
- finds Master's programs in AI / related fields that match your filters;
- finds funding opportunities (GA, TA, RA, fellowships) per program;
- finds the right professors, graduate directors, and coordinators;
- attaches a **source** to every single fact (URL, page snippet, etc.).

If a program or funding opportunity has no source, it is rejected. This is intentional — the system would rather know less than tell you something it cannot back up.

### Step 3 — Writing

```bash
pnpm run:writing
```

What this does:
- drafts an SOP, short answers, cover letter, and outreach message for the first program;
- runs a critic, a fact-check, and a style-check on every draft;
- saves drafts to `out/writing/`.

Open one of the `.md` files there and read it. Each draft will tell you, at the bottom, which user-side facts and which program-side evidence it used. Anything it could not justify is **removed**, not faked.

If a draft says "needs_user_input", that is the system asking you for something specific (e.g., a missing detail, a story it could not pin down). It is not broken — it is being honest.

### Step 4 — Application prep

```bash
pnpm run:application-prep
```

What this does:
- per program, builds a checklist of required items (SOP, resume, transcripts, recommendations placeholder, fee, test scores, etc.);
- marks each item as `completed`, `needs_user_input`, or `missing`;
- produces an **approval queue** — the explicit list of human decisions waiting on you.

Each item in the queue says exactly *why* it is there (e.g., "draft is ready for your approval", "you have not provided a fee waiver decision", "this short-answer draft tripped the style check").

### Step 5 — Approvals + persistence

```bash
pnpm run:approval-cycle
```

What this does:
- saves everything from steps 1–4 into the local data store;
- simulates a few sample decisions (approve one draft, request edits on another, approve a missing-input attestation);
- shows you the queue before and after;
- proves the system can resume from saved state.

After this command, look in `out/approval-cycle/` for the JSON snapshots. Those are the source of truth — you can open them in any text editor.

---

## 6. How approvals work

Approvals are how the system asks **you** to make a decision before anything irreversible happens. There are four kinds you will see today:

| Action type | What it means | What you do |
| --- | --- | --- |
| `approve_draft` | "Here is a draft. I think it is ready. Do you agree?" | Read the draft. Approve, request edits, or reject. |
| `edit_required` | "I drafted this but my own check did not pass." | Read the critic's note. Either rewrite manually, or request a different angle. |
| `missing_input` | "I cannot fill this without information from you." | Provide the info (in your JSON file, or attest in the approval). |
| `ready_for_submission` | "All other approvals on this application are decided. The packet is assembled." | Confirm only when you are ready to actually send it yourself in the school portal. **The system will not click submit for you.** |

Each approval includes:

- the **reason** it exists,
- a **grounding summary** showing which of your verified facts support it,
- an **evidence summary** showing which sources back the program-side claims,
- a **decision note** field for you to record why you decided what you decided.

Nothing in the system advances past an approval until you decide.

---

## 7. What "blocked" means

If a program shows status `blocked`, that means **you cannot reach `ready_for_user_submission` yet** because at least one required item is missing. Common causes:

- You have not yet uploaded a transcript.
- You have not provided test scores or attested they are not required.
- You have not made a decision about the application fee (pay it, or claim a waiver).
- One of the drafts failed grounding or style checks and needs your edit.

`blocked` is a **safe** state. It means the system refuses to mark something done that is not actually done. To clear it:

1. Look at the application's `blockers` list in the JSON snapshot or the printed output.
2. Address each item — either by editing your profile JSON, or by resolving the related approval.
3. Re-run the steps above.

---

## 8. Step-by-step recap

If you remember nothing else, remember this list. It is the entire flow:

1. **Once.** Install Ollama, pull `qwen3:8b`, run `pnpm check:model`.
2. **Once per cycle.** Edit `fixtures/seeds/onboarding-sample.json` (or your copy) with your real info.
3. `pnpm run:onboarding`
4. `pnpm run:research-sweep`
5. `pnpm run:writing`
6. `pnpm run:application-prep`
7. `pnpm run:approval-cycle`
8. Open the files in `out/` and decide on the approvals.

Repeat steps 3–8 whenever your information changes or new programs/funding opportunities appear.

---

## 9. When things go wrong

The most common issues, in order of frequency:

1. **`ollama serve` is not running.** Open a terminal and run it. Leave the window open.
2. **The model is not pulled.** Run `ollama pull qwen3:8b`.
3. **A run says "needs_user_input" or "blocked".** That is **not a bug**. Read the listed reasons; provide the missing input.
4. **A draft says it failed grounding.** That means it tried to write a fact it could not trace to your profile or to evidence. Either add the missing fact (truthfully) to your profile, or accept that the draft will skip it.

Anything that *is* a bug will print a clear error message ending with a `Hint:` line. If it doesn't, that is itself a bug — please file an issue.

---

## 10. The non-negotiables

These are the rules the system enforces, no exceptions:

- It will never submit an application for you.
- It will never pay a fee for you.
- It will never email or message anyone for you.
- It will never write a fact about you that it cannot back up.
- It will always tell you when it is uncertain.

If something feels fishy or "too easy", it probably is — please report it. The point of a personal admissions agent is to make you faster, not to forge things on your behalf.
