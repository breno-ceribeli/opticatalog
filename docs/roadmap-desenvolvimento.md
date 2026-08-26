Roadmap de Desenvolvimento
==========================

# Roadmap de Desenvolvimento — Inventário Visual

Este documento é o guia operacional do que precisa ser construído, em ordem, com detalhe suficiente para orientar você (ou uma IA assistente no VS Code) durante a implementação. Ele assume que o setup do ambiente (guia-setup-projeto.md) e as decisões de arquitetura (documentacao-projeto-inventario-visao.md) já estão prontos.

**Como usar este documento com uma IA de código:** cole a fase inteira (ou a etapa específica) como contexto ao pedir ajuda para implementar. Cada etapa lista o objetivo, os arquivos envolvidos, e o critério de "pronto".

---

## Visão geral das fases

| Fase | O que entrega                        | Por que essa ordem                                 |
| ---- | ------------------------------------ | -------------------------------------------------- |
| 0    | Setup do ambiente                    | Pré-requisito de tudo                             |
| 1    | Câmera funcionando                  | Base de toda a captura                             |
| 2    | SQLite funcionando                   | Sem isso, nada persiste                            |
| 3    | Integração com a Cloud Vision      | Parte que mais vale nota (4 pts) — priorizar cedo |
| 4    | Tela de revisão/confirmação       | Onde o usuário edita antes de salvar              |
| 5    | OCR + checagem de duplicado          | Complementa a Fase 3                               |
| 6    | Sincronização com Supabase         | Fecha os requisitos de offline-first               |
| 7    | Telas de histórico e inventário    | Visualização dos dados já funcionando           |
| 8    | Upload de imagens (Supabase Storage) | Pode vir depois, não bloqueia o resto             |
| 9    | Polimento e ensaio da apresentação | Última etapa, só depois de tudo funcionando      |

---

## Fase 0 — Setup (ver guia-setup-projeto.md)

Checklist resumido — detalhes completos no outro documento:

- [X] Node.js, Expo Go, projeto Expo criado e rodando no celular
- [X] Dependências instaladas (`expo-camera`, `expo-image-picker`, `expo-image-manipulator`, `expo-sqlite`, `expo-file-system`, `@react-native-community/netinfo`, `@supabase/supabase-js`, `@react-native-async-storage/async-storage`, `react-native-url-polyfill`)
- [X] Projeto Supabase criado, tabelas `analises` e `itens_inventario` criadas com o SQL definido, bucket `fotos-inventario` criado
- [X] Projeto Google Cloud criado, faturamento ativado (cartão, sem pré-pagamento), Cloud Vision API ativada, chave gerada e testada via curl
- [X] `.env` configurado com `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_GOOGLE_VISION_API_KEY`

---

## Fase 1 — Câmera funcionando

**Objetivo:** tirar uma foto e exibi-la na tela, sem nenhuma análise ainda.

**Arquivos:** `app/index.tsx` (ou tela inicial equivalente no Expo Router)

**O que implementar:**

1. Pedir permissão de câmera (`expo-camera`, hook `useCameraPermissions`).
2. Renderizar a `CameraView` em tela cheia, com um botão de captura.
3. Ao tocar no botão, tirar a foto (`takePictureAsync`) e navegar/mostrar uma tela de preview com a imagem capturada.
4. Botões na tela de preview: "Usar essa foto" (segue fluxo) e "Tirar de novo" (descarta e volta pra câmera).

**Critério de pronto:** conseguir tirar uma foto no celular físico (via Expo Go) e ver a prévia na tela, sem erros de permissão.

---

## Fase 2 — SQLite funcionando

**Objetivo:** salvar a foto tirada como um registro `pendente`, e listar o histórico.

**Arquivos:** `src/db/schema.ts`, `src/db/queries.ts`

**O que implementar:**

1. `schema.ts`: função `iniciarBanco()` que abre a conexão (`expo-sqlite`, API assíncrona) e roda `CREATE TABLE IF NOT EXISTS` para `analises` e `itens_inventario`, com o schema definido no documento principal (campos, tipos, `sincronizado INTEGER DEFAULT 0`). Chamar essa função uma vez, na inicialização do app (ex: no layout raiz do Expo Router).
2. `queries.ts`: funções básicas —
   - `criarAnalise(dados)` → insere um registro em `analises` com `status: 'pendente'`, `id` gerado com `crypto.randomUUID()`.
   - `listarAnalises()` → retorna todas, ordenadas por `criado_em desc`.
   - `atualizarAnalise(id, dados)` → usado depois, quando a Cloud Vision responder.
3. Mover o arquivo de imagem da Fase 1 para um diretório permanente (`FileSystem.documentDirectory + 'fotos/'`) antes de salvar `imagem_uri` no banco — não usar a pasta de cache.
4. Comprimir a imagem antes de salvar (`expo-image-manipulator`, resize para ~1280px de largura, qualidade ~0.7).

**Critério de pronto:** tirar uma foto, ela aparece como novo registro `pendente` numa lista simples na tela (mesmo sem nenhuma análise ainda), e persiste depois de fechar e reabrir o app.

---

## Fase 3 — Integração com a Cloud Vision

**Objetivo:** enviar a foto pendente pra API e salvar o resultado.

**Arquivos:** `src/services/visionApi.ts`

**O que implementar:**

1. Função `analisarImagem(caminhoLocal)`:
   - Lê o arquivo local e converte para base64 (`FileSystem.readAsStringAsync` com `encoding: 'base64'`).
   - Monta o request para `POST https://vision.googleapis.com/v1/images:annotate?key=...`, pedindo `OBJECT_LOCALIZATION` e `LABEL_DETECTION` na mesma chamada.
   - Trata a resposta: extrai o objeto de maior confiança (nome) e a lista de labels (nome + score).
   - Retorna algo como `{ objeto_detectado, labels }`.
2. Ao voltar da Fase 2 com um registro `pendente`: chamar `analisarImagem`, e no retorno, chamar `atualizarAnalise(id, { objeto_detectado, labels_json: JSON.stringify(labels), status: 'processado' })`.
3. Tratar erro de rede/API (marcar `status: 'erro'`, permitir tentar de novo manualmente).
4. **Checar conectividade antes de chamar a API** (`@react-native-community/netinfo`) — se offline, não tentar, deixar como `pendente` para a Fase 6 processar depois.

**Critério de pronto:** tirar uma foto de um objeto real, ver o `objeto_detectado` e os `labels` aparecerem salvos no registro depois de alguns segundos.

---

## Fase 4 — Tela de revisão/confirmação

**Objetivo:** usuário vê a sugestão da IA, edita o que quiser, define a categoria manualmente, e confirma o lançamento no inventário.

**Arquivos:** tela de revisão (ex: `app/revisao/[id].tsx`), `src/db/queries.ts` (novas funções)

**O que implementar:**

1. Tela mostrando: imagem, campo `nome` (pré-preenchido com `objeto_detectado`, editável), campo `categoria` (vazio, o usuário digita ou escolhe de uma lista fixa que você define no app), lista de `tags` (pré-preenchida com `labels`, o usuário pode remover ou adicionar), campo `descricao` (vazio, editável), botão opcional "Ler texto (OCR)" (ver Fase 5).
2. Botão "Salvar no inventário" → dispara a lógica de confirmação (ver Fase 5, que já inclui a checagem de duplicado).

**Critério de pronto:** a partir de uma análise processada, revisar e editar os campos, e confirmar sem erros.

---

## Fase 5 — OCR + checagem de duplicado

**Objetivo:** implementar o botão de OCR e a lógica de duplicado descrita na documentação.

**Arquivos:** `src/services/visionApi.ts` (nova função), `src/db/queries.ts` (lógica de confirmação)

**O que implementar:**

1. `lerTexto(caminhoLocal)`: mesma lógica de `analisarImagem`, mas pedindo `TEXT_DETECTION`. Salva o resultado em `analises.texto_ocr`.
2. Botão "Ler texto" na tela de revisão chama essa função e atualiza a tela com o texto encontrado (pré-preenchendo `descricao`).
3. Função `confirmarItem(analiseId, dadosEditados)`:
   - Se `texto_ocr` da análise não é vazio: buscar em `itens_inventario` um item com `identificador_ocr` igual. Se encontrar → `UPDATE` (incrementa `quantidade`, atualiza `atualizado_em`). Se não encontrar → `INSERT` novo item, com `identificador_ocr = texto_ocr`.
   - Se não há `texto_ocr`: sempre `INSERT` novo item (`identificador_ocr = null`).
   - Em ambos os casos, gravar `nome`, `categoria`, `tags_json`, `descricao` com os valores editados pelo usuário na tela, e `analise_origem_id` apontando para a análise de origem.

**Critério de pronto:** confirmar dois itens diferentes gera duas linhas em `itens_inventario`; confirmar dois itens com o mesmo texto de OCR incrementa a quantidade do mesmo item ao invés de duplicar.

---

## Fase 6 — Sincronização com Supabase

**Objetivo:** subir os registros pendentes de sincronização quando há internet.

**Arquivos:** `src/services/supabase.ts`, `src/services/sync.ts`

**O que foi implementado:**

1. `supabase.ts`: cliente Supabase inicializado com `createClient` + `AsyncStorage` para persistência.
2. `sync.ts`: motor de sincronização completo:
   - `sincronizarTudo()`: busca registros com `sincronizado = 0`, faz upload de imagens, upsert no Supabase, marca como sincronizado.
   - `baixarItensRemotos()`: busca itens do Supabase, cria stubs de análise local, baixa imagens, insere localmente.
   - `excluirRemoto()`: deleta do Supabase (tabelas + Storage).
   - Mapeamento de colunas: `labels_json`→`labels`, `tags_json`→`tags`, timestamps INTEGER→ISO.
   - Upload de imagens: base64 → ArrayBuffer → `supabase.storage.upload()` → URL pública.
   - Download de imagens: `FileSystem.downloadAsync()` → salva localmente.
3. `app/_layout.tsx`: listener NetInfo → sync automático ao reconectar + sync inicial ao abrir o app.
4. `app/historico.tsx`: UI completa de sincronização:
   - Indicador "Sincronizado"/"Nao sincronizado" em cada card.
   - Toggle "Nao sincronizados" para filtrar.
   - Botão "Sincronizar" (envia pendentes).
   - Botão "Baixar" (busca itens remotos).
   - Exclusão seletiva: "Apenas localmente" ou "Em todos os lugares".
   - Thumbnail do item via `imagem_uri` (local ou baixado).
5. `src/db/queries.ts`: funções auxiliares `marcarItemSincronizado()`, `listarItensNaoSincronizados()`, `obterItemPorId()`. `atualizarAnalise()` agora reseta `sincronizado=0`.

**Critério de pronto:** criar um item com o celular no modo avião, confirmar que fica marcado como não sincronizado, reativar a internet, e ver o registro aparecer no painel do Supabase (Table Editor) pouco depois.

---

## Fase 7 — Telas de histórico e inventário

**Objetivo:** visualizar os dados já persistidos.

**Arquivos:** `app/historico.tsx`, `app/inventario.tsx`

**O que implementar:**

1. **Histórico**: lista de `analises`, mais recentes primeiro, mostrando miniatura, `objeto_detectado`, status (`pendente`/`processado`/`erro`), e indicador de sincronizado ou não.
2. **Inventário**: lista de `itens_inventario`, mostrando nome, categoria, tags, quantidade. Permitir tocar num item para editar manualmente depois (nome, categoria, descrição, tags).
3. **Contagem por categoria**: consulta agregada (`SELECT categoria, COUNT(*) FROM itens_inventario GROUP BY categoria`) exibida como resumo simples no topo da tela de inventário.

**Critério de pronto:** as duas telas navegáveis, mostrando dados reais do banco, atualizando ao voltar de uma nova captura.

---

## Fase 8 — Upload de imagens (se ainda não fechado na Fase 6)

Já coberto na Fase 6, mas vale revisar isoladamente: testar o cenário de imagem grande, upload falhando por timeout, e re-tentativa.

---

## Fase 9 — Polimento e ensaio para a apresentação

- [ ] Testar o fluxo completo do zero, num celular limpo (reinstalando o app), simulando exatamente o que o professor vai ver.
- [ ] Preparar 2-3 objetos físicos variados para demonstrar ao vivo (idealmente um deles com texto legível, pra mostrar o OCR).
- [ ] Testar o cenário offline→online ao vivo (tirar foto no avião, mostrar a fila, reativar internet, mostrar sincronizando).
- [ ] Revisar mensagens de erro (rede caiu, API não respondeu) — não deixar a tela travada sem feedback nenhum.
- [ ] Ensaiar a fala explicando a arquitetura (offline-first, por que categoria é manual, como funciona a checagem de duplicado) — isso mostra domínio do projeto além do código funcionando.

---

## Backlog de melhorias (não essencial para a nota, mas documentado para o futuro)

- OCR/detecção de objeto rodando 100% offline via ML Kit (exige EAS Dev Build — ver seção correspondente na documentação principal).
- Autenticação de usuário real (Supabase Auth) + RLS restrito por `user_id`, ao invés das políticas abertas atuais.
- Chamada à Cloud Vision via Supabase Edge Function, para não expor a chave de API no app.
- Modo "scanner" com captura automática a cada poucos segundos, para uma sensação de análise contínua.
