# Stagecraft Labs

This repo is built by Claude Code.

## Hard requirements

- TypeScript 7 (currently 7.0.2). Before adding a dependency, confirm it supports TS 7: check its `typescript` peer range, its shipped types, and any use of the compiler API. If it doesn't, pick an alternative. Never downgrade TypeScript or override peer dependencies to force a package in.
- Keep the repo easy for an agent to work in. Checks must be fast, non-interactive and deterministic. Prefer strict settings that fail loudly. Update this file whenever commands or structure change.
