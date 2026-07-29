---
description: Capture lessons from this session into the studio knowledge base (runs capture-learnings).
---

Run the studio-core `capture-learnings` skill to distill and record durable
lessons from this session into the studio knowledge base
(`knowledge/LEARNINGS.md`), then commit/push them via the studio
`sync-learnings.sh` script so they propagate to every environment.

This repo defines `/learn` as **lesson-capture** — matching CLAUDE.md's
studio-core incremental-learning loop — overriding the generic "Learning Mode"
tutor skill of the same name that ships in the user profile.

Focus on: corrections the user made, repeated mistakes or dead ends, non-obvious
project facts/gotchas, and patterns explicitly approved. Write one lesson per
entry with concrete `Trigger` keywords, show me what you added, and commit it. If
nothing meets the bar, say so instead of inventing entries.

$ARGUMENTS
