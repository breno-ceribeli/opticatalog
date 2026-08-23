# Opticatalog — Inventário Visual (Expo 54)

## Leia nesta ordem
1. `docs/documentacao-projeto.md` — arquitetura, schema, fluxos, decisões
2. `docs/roadmap-desenvolvimento.md` — 9 fases operacionais com critérios de pronto

## Regras arquiteturais (não violar)
- **ID client-side** (`crypto.randomUUID()`) — mesmo ID no SQLite e Supabase (upsert direto)
- **Categoria sempre manual** — IA não sugere; usuário define na confirmação
- **Duplicado só por OCR** — sem texto lido, não adivinha; só mostra contagem por categoria
- **Offline-first real** — captura/salva local sempre; análise (Cloud Vision) fila se offline
- **Chave Cloud Vision no app** — MVP consciente; migrar para Edge Function depois

## Comandos
```bash
npm start          # Expo
npm run lint       # ESLint
npx tsc --noEmit   # Typecheck
```

## Fase atual
**Fase 1 — Câmera funcionando** (`roadmap-desenvolvimento.md:40`). Objetivo: tirar foto, preview, navegar para revisão.