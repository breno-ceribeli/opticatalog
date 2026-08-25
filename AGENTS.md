# Opticatalog — Inventário Visual (Expo 54)

## Leia nesta ordem
1. `docs/documentacao-projeto.md` — arquitetura, schema, fluxos, decisões
2. `docs/roadmap-desenvolvimento.md` — 9 fases operacionais com critérios de pronto
3. `docs/cloud-vision-api.md` — integração Cloud Vision (Label Detection + Object Localization + OCR)

## Regras arquiteturais (não violar)
- **ID client-side** (`crypto.randomUUID()`) — mesmo ID no SQLite e Supabase (upsert direto)
- **Categoria sempre manual** — IA não sugere; usuário define na confirmação
- **Duplicado só por OCR** — sem texto lido, não adivinha; só mostra contagem por categoria (checagem de duplicado via OCR será implementada no futuro)
- **Offline-first real** — captura/salva local sempre; análise (Cloud Vision) fila se offline
- **Chave Cloud Vision no app** — MVP consciente; migrar para Edge Function depois

## Comandos
```bash
npm start          # Expo
npm run lint       # ESLint
npx tsc --noEmit   # Typecheck
```

## Fase atual
**Fase 5 — OCR (Text Detection)** (`roadmap-desenvolvimento.md:109`). Objetivo: botão "Ler texto" na revisão → chamada TEXT_DETECTION separada → preencher campo descrição com texto extraído.