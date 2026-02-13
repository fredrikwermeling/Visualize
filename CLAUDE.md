# Project Instructions

## Git Workflow
- Always push changes to remote after committing. Never leave commits local-only.

## Token Usage — CRITICAL
- Minimize token consumption at all times. This is a top priority.
- Use haiku or sonnet for any subagent tasks — only use opus for tasks that truly require it.
- Avoid spawning unnecessary subagents. Prefer direct tool calls (Read, Grep, Glob, Edit) over Task agents.
- Do not read entire files upfront. Use Grep or Read with offset/limit to read only the sections needed for the current edit.
- Keep responses short. Do not over-explain.
- After context compaction, re-read this file to remember these rules.
