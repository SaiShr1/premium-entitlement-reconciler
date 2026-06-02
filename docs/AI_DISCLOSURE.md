# AI-Assisted Development Disclosure

This project was built with AI assistance (Claude, by Anthropic) as a development partner. This document describes what the AI contributed, what I contributed, and how the collaboration worked.

## How It Worked

I authored [`project-context.md`](./project-context.md) as the planning document — it defines the architecture, schema, state machine, module map, phase breakdown, and all design decisions (first-write-wins, SKIP LOCKED, raw SQL over ORM, etc.). This file served as the source of truth for the entire build.

The AI acted as a senior pair-programming partner: given the plan, it helped scaffold code per phase, suggested implementation patterns, debugged issues, and drafted boilerplate (DTOs, module wiring, test setup). I reviewed, modified, and integrated every piece.

## What I Owned

- All architectural decisions (channel ownership model, first-write-wins, concurrency strategy, schema design)
- The full project plan (`project-context.md`) — written before any AI involvement
- Technology choices and tradeoffs (Postgres over SQLite, NestJS over Fastify, raw SQL over ORM)
- Code review and refactoring (e.g., restructuring test file locations, renaming services)
- Bug diagnosis and understanding (e.g., `esModuleInterop` vs `allowSyntheticDefaultImports`, `SKIP LOCKED` race conditions in tests, Postgres type mismatches)
- Final integration and verification of every feature

## What AI Contributed

- Code scaffolding from the plan (translating design decisions into NestJS boilerplate)
- Test case implementation (from the test matrix I defined in `project-context.md`)
- Dockerfile and docker-compose authoring
- Debugging assistance (migration file paths, supertest import issues, jest parallelism conflicts)
- Documentation drafting (README, local testing guide)

## Why Disclose This

AI-assisted development is becoming standard practice. The value isn't in typing code — it's in making the right decisions about what to build and how. The plan, the architecture, and the understanding behind every line are mine. The AI accelerated the mechanical parts of turning that plan into working code.

I can explain and defend every design decision, every query, and every tradeoff in this codebase.
