# archaeo

> Your codebase has a memory. Now you can query it.

archaeo mines your entire git history — commits, PR descriptions, diffs — builds a persistent knowledge graph, and lets you ask natural language questions about why your code is the way it is.

```bash
npm install -g archaeo
```

---

## The problem

A senior engineer leaves. With them goes years of context about why the codebase is structured the way it is. New developers spend weeks deciphering code with no explanation. Teams repeat past mistakes because nobody remembers what was tried before.

Confluence pages go stale. Inline comments get deleted. Notion docs are never updated.

**The only source of truth that is always accurate is git itself — but nobody made it queryable. Until now.**

---

## What it does

```bash
# Index your repo once
archaeo init

# Ask anything
archaeo ask "why do we use Redis for sessions instead of JWT?"

# See the full history of any file
archaeo history src/auth/auth.service.ts

# Check if your current changes undo a past decision
archaeo check

# Keep the index fresh
archaeo update
```

---

## Demo

```
$ archaeo ask "why was the services folder created?"

── Apr 15 2025  @uday
   feat: add Phase 4 services - filter, git, github, embedder (da5e4bf)

── Apr 14 2025  @uday
   feat: add retrieval and claude services (4053ac3)

── Apr 13 2025  @uday
   feat: wire up CLI entry point (fd512c0)

Summary:
The services folder was introduced to organise the core business logic
of the CLI into discrete, single-responsibility modules. Each service
owns one concern — git operations, GitHub API calls, embedding generation,
conflict detection, and AI synthesis — keeping the command layer thin
and the logic testable.
```

---

## How it works

archaeo is not a wrapper around AI. The heavy lifting happens before AI ever sees a token:

1. **Index** — parses your entire git history, extracts diffs, builds a knowledge graph of file → commit → PR relationships
2. **Embed** — converts every commit into a semantic vector using a local embedding model (no API calls, no data leaving your machine)
3. **Retrieve** — when you ask a question, finds the most semantically relevant commits using vector similarity search + re-ranking
4. **Synthesise** — passes only the relevant commits to the AI for a concise, grounded summary

AI handles exactly one step. Everything else is deterministic.

---

## Installation

```bash
npm install -g archaeo
```

**Requirements:**

- Node.js 20+
- A git repository
- A Gemini API key (free tier works) — [get one here](https://aistudio.google.com/apikey)

---

## Setup

```bash
# Set your Gemini API key
export GEMINI_API_KEY=your-key-here

# Optional: add GitHub token for richer PR context
export GITHUB_TOKEN=ghp_your-token

# Index your repo (one-time, ~1 min for most repos)
cd your-project
archaeo init
```

---

## Commands

| Command                    | Description                                   |
| -------------------------- | --------------------------------------------- |
| `archaeo init`             | Index the repo for the first time             |
| `archaeo ask '<question>'` | Ask a natural language question               |
| `archaeo history <file>`   | Show timeline of changes to a file            |
| `archaeo check`            | Detect if current changes undo past decisions |
| `archaeo update`           | Incrementally index new commits               |
| `archaeo status`           | Show index stats                              |
| `archaeo config`           | View and edit configuration                   |

---

## Privacy

**Your code never leaves your machine.**

archaeo stores everything in a local SQLite database at `.archaeo/index.db`. The only external calls are:

- GitHub API — to fetch PR descriptions (optional, needs token)
- Gemini API — to synthesise the final answer from pre-filtered commits

The embedding model runs fully locally using `@xenova/transformers`. No commit content is ever sent for embedding.

---

## Tech stack

- **Runtime** — Node.js 20+ with TypeScript
- **CLI** — Commander.js
- **Git** — simple-git
- **GitHub** — @octokit/rest
- **Embeddings** — @xenova/transformers (local, offline)
- **Vector search** — sqlite-vec
- **Database** — better-sqlite3
- **AI synthesis** — Gemini API

---

## Roadmap

- [ ] VS Code extension — right-click any function to see its full history
- [ ] Shared team index — institutional memory that survives engineer departures
- [ ] GitHub PR bot — auto-runs conflict detection on every PR
- [ ] Slack integration — ask questions from Slack

---

## Contributing

Issues and PRs welcome. This is early — feedback on retrieval quality and edge cases is especially valuable.

---

## License

MIT

---

Built by [@UDAY005-UI](https://github.com/UDAY005-UI)
