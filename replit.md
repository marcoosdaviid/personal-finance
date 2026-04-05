# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

### Personal Finance App (`finance-app`)
- **Path**: `/` (root)
- **Type**: react-vite
- **Framework**: React + Vite + Wouter routing + TanStack Query + Recharts
- **Pages**: Dashboard, Transactions, Budgets, Accounts

### API Server (`api-server`)
- **Path**: `/api`
- **Routes**: /accounts, /categories, /transactions, /budgets, /dashboard/summary, /dashboard/spending-by-category, /dashboard/monthly-trend

## Database Schema

- **accounts**: id, name, type (checking/savings/credit/investment/cash), balance, currency, color, createdAt, updatedAt
- **categories**: id, name, icon, color, type (income/expense/both), createdAt
- **transactions**: id, accountId, categoryId, type (income/expense), amount, description, date, notes, createdAt
- **budgets**: id, categoryId, amount, month (YYYY-MM), createdAt

## Features

- Track income and expenses across multiple accounts
- Categorize transactions with custom icons and colors
- Set monthly budgets per category and track progress
- Dashboard with spending breakdowns and 6-month income vs expense trend charts
- Pre-seeded with sample data (3 accounts, 12 categories, 23 transactions, 8 budgets for April 2026)
