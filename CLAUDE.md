# Project Instructions

## Git Workflow
- Always push changes to remote after committing. Never leave commits local-only.

## Token Usage
- Minimize token consumption. Use haiku or sonnet for subagent tasks whenever possible — only use opus for tasks that truly require it.
- Avoid spawning unnecessary subagents. Prefer direct tool calls (Read, Grep, Glob, Edit) over Task agents for simple operations.
- Do not read all project files upfront. Read only what is needed for the current step.
