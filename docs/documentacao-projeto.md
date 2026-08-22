Documentação do Projeto
========================

# Aplicação Mobile com Visão Computacional — Inventário Visual

Documento de referência do projeto para a disciplina, com escopo, funcionamento, stack e decisões de arquitetura. Apresentação em sala: 30/09.

---

## 1. Problema que o app resolve

Controle de inventário/patrimônio sem depender de código de barras ou catalogação manual. Útil para pequenos negócios, oficinas, laboratórios ou uso doméstico, onde os itens não têm etiqueta padronizada.

O usuário aponta a câmera para um objeto, o app identifica o que é (nome + tags relacionadas) e, opcionalmente, lê texto visível no item (etiqueta, número de série, marca) para complementar a descrição e ajudar a diferenciar itens parecidos. A categoria é definida manualmente pelo usuário na confirmação — a API não retorna esse dado.

---

## 2. Funcionalidades

1. **Captura e detecção de objeto** — foto tirada pelo usuário é enviada para análise; o app identifica o objeto (ex: "Cadeira", "Furadeira") e retorna tags relacionadas (ex: "Furniture", "Wood").
2. **OCR complementar (botão separado, opcional)** — lê texto visível no item e adiciona como campo "Descrição", ajudando a diferenciar fisicamente itens do mesmo tipo (ex: dois itens "Notebook", um com número de série lido, outro sem).
3. **Checagem de duplicado baseada em evidência real** — só considera um item como "o mesmo já cadastrado" quando o texto lido via OCR bate com um item existente. Sem essa evidência, o sistema não tenta adivinhar.
4. **Contagem por categoria** — estatística simples via consulta agregada no banco (quantos itens existem por categoria/nome), sem tentativa de reconhecimento de duplicado por imagem.
5. **Edição manual** — nome e tags sugeridos pela IA são um ponto de partida editável; a categoria é sempre definida manualmente pelo usuário (sem sugestão automática) antes de confirmar o lançamento no inventário.
6. **Histórico de análises** — toda captura fica registrada, mesmo repetidas.
7. **Inventário consolidado** — lista de itens únicos com quantidade, categoria e descrição.
8. **Offline-first para armazenamento** — captura e salvamento local sempre funcionam, mesmo sem internet. A etapa de análise (que depende da API na nuvem) fica marcada como "pendente" e é processada automaticamente quando a conexão volta, sincronizando em seguida com o Supabase.

---

## 3. Fluxo de uso

```
Tirar foto
   → Salvar no SQLite (status: pendente)
      → [sem internet: fica na fila]
      → [com internet] Enviar para Cloud Vision (objeto + tags)
         → Usuário revisa/edita nome e tags, define a categoria manualmente
         → (opcional) Botão "Ler texto" → OCR via Cloud Vision → preenche Descrição
         → Se texto bateu com item existente → atualiza item (não duplica)
         → Se não → cria novo item no inventário
      → Sincroniza com Supabase
```

**Importante:** a análise (Cloud Vision) sempre depende de internet — não há OCR nem detecção de objeto offline nesta versão. O que é offline-first é a captura e o armazenamento: o app nunca trava ou perde dados por falta de conexão, apenas adia o processamento.

---

## 4. Stack

| Camada | Tecnologia | Observação |
|---|---|---|
| App mobile | React Native + Expo (managed workflow) | Uso do Expo Go padrão — sem necessidade de EAS Dev Build nesta fase |
| Câmera | `expo-camera` / `expo-image-picker` | Módulos nativos já inclusos no Expo Go |
| Visão computacional | Google Cloud Vision API | Features usadas: Object Localization, Label Detection, Text Detection (OCR). Chamada HTTP direta do app (fetch), sem SDK nativo. Requer conta de faturamento com cartão; gratuito até 1.000 unidades/mês por feature dentro dessa conta |
| Banco local | Expo SQLite | Armazenamento offline-first e fila de pendências |
| Banco em nuvem | Supabase (PostgreSQL) | Persistência online e sincronização entre dispositivos |
| Chave de API | Direto no app (sem Edge Function por enquanto) | Decisão consciente para simplificar o MVP; pode migrar para Supabase Edge Function depois, se necessário, para não expor a chave publicamente |

### Nota sobre offline "de verdade" (não usado agora, mas documentado)

É tecnicamente possível rodar OCR e detecção de objeto **offline**, usando o Google ML Kit on-device (ex: `@infinitered/react-native-mlkit-text-recognition`, `@infinitered/react-native-mlkit-object-detection`). Isso exige sair do Expo Go padrão e usar um **EAS Build / Development Build** (build customizado com módulos nativos, gerado pelo próprio Expo, instalado no celular no lugar do app da loja). Não é usado nesta versão do projeto por decisão de manter o setup simples, mas é uma evolução possível sem precisar reescrever a arquitetura — bastaria adicionar a lib e gerar um novo build.

---

## 5. Banco de dados

**Princípio importante:** o `id` de cada registro é gerado **no próprio app** (client-side, via `crypto.randomUUID()`), não pelo banco. É o mesmo ID usado tanto no SQLite quanto no Supabase — assim a sincronização é um upsert direto por `id`, sem precisar "traduzir" IDs locais para remotos.

**Lógica geral:** `analises` guarda o que a API devolveu bruto para aquela captura (objeto, labels/tags, e o texto do OCR se foi usado); `itens_inventario` guarda a versão consolidada e editável, copiada de `analises` no momento da confirmação, podendo divergir depois conforme o usuário edita.

### O que a Cloud Vision realmente retorna (base para os campos abaixo)

- **Object Localization**: identifica objetos discretos na foto (nome + posição + confiança). Vocabulário relativamente genérico (ex: "Chair", "Bottle").
- **Label Detection**: lista de tags descritivas sobre a imagem inteira, cada uma com um score (ex: "Cat", "Mammal", "Whiskers"). Não existe uma "categoria" pronta vinda da API — nenhuma das duas features retorna isso. Por decisão do projeto, **não usamos dicionário de mapeamento automático**: a categoria é um campo puramente manual, definido pelo usuário na hora de confirmar o item.
- As duas features podem ser pedidas na mesma chamada HTTP.

### Expo SQLite (local)

**Tabela `analises`** — histórico bruto, uma linha por captura (sempre criada, mesmo sem o usuário confirmar nada depois):
- `id` (TEXT, UUID gerado no app)
- `imagem_uri`
- `objeto_detectado` (nome sugerido, da Object Localization)
- `labels_json` (TEXT — JSON serializado da lista de labels/tags da Label Detection)
- `texto_ocr` (nullable — preenchido se o usuário usar o botão de OCR nessa análise)
- `status` (`pendente` | `processado` | `erro`)
- `criado_em`
- `sincronizado` (INTEGER 0/1 — SQLite não tem tipo boolean nativo)

**Tabela `itens_inventario`** — visão consolidada, um registro por item real cadastrado. Só é criado/atualizado quando o usuário revisa e **confirma** a partir de uma análise:
- `id` (TEXT, UUID gerado no app)
- `analise_origem_id` (referencia o `id` da análise que originou este item — rastreabilidade)
- `nome` (copiado de `objeto_detectado`, editável)
- `categoria` (campo manual — o usuário define/digita na confirmação; sem sugestão automática)
- `tags_json` (TEXT — JSON serializado, copiado de `labels_json`; usuário pode adicionar/remover tags)
- `descricao` (texto editável pelo usuário; copiado de `texto_ocr` como valor inicial, mas o usuário pode reescrever livremente)
- `identificador_ocr` (nullable — cópia **fixa, não editável** do texto bruto do OCR, usada só internamente para checagem de duplicado; diferente de `descricao`, que o usuário pode alterar)
- `quantidade`
- `criado_em`
- `atualizado_em`
- `sincronizado` (INTEGER 0/1)

### Supabase (PostgreSQL, nuvem)

Espelha as duas tabelas locais (mesmos campos, `sincronizado` como boolean de verdade, `labels`/`tags` como `jsonb` nativo do Postgres em vez de texto serializado), adicionando `user_id` para isolar dados por usuário (com RLS — Row Level Security — habilitado). O `id` não tem valor padrão gerado pelo banco — ele sempre chega já preenchido do app. **Diferença importante:** a coluna `imagem_uri` (caminho local) não existe do lado remoto — ela é substituída por `imagem_url`, preenchida só durante a sincronização, depois que a imagem é enviada ao Supabase Storage (ver seção 5.1).

### 5.1 — Armazenamento das imagens

- **Local:** a foto capturada é salva como arquivo permanente no celular via `expo-file-system` (não na pasta de cache), redimensionada/comprimida antes de salvar (ex: `expo-image-manipulator`, máx. ~1280px de largura). O caminho desse arquivo é o que fica em `analises.imagem_uri` no SQLite.
- **Remoto:** um caminho de arquivo local não significa nada fora do próprio celular. Na sincronização, o arquivo é enviado a um bucket do **Supabase Storage**, e a URL pública/assinada resultante é salva em `analises.imagem_url` na tabela remota.
- **`itens_inventario` não guarda imagem própria** — como ele referencia `analise_origem_id`, a miniatura do item é obtida buscando a imagem da análise de origem. Evita duplicar a mesma imagem em dois lugares.

### Lógica de sincronização

A cada mudança de conectividade (via `NetInfo`) ou ação manual do usuário:
1. Busca registros locais com `sincronizado = false` em ambas as tabelas.
2. Para registros de `analises` pendentes: faz upload da imagem para o Supabase Storage, obtém a `imagem_url`.
3. Faz upsert no Supabase (tabelas + imagem) usando o mesmo `id` gerado localmente.
4. Marca como `sincronizado = true` após confirmação.

---

## 6. Fluxo completo de OCR e checagem de duplicado (versão final)

Passo a passo de como o OCR se encaixa, do zero:

1. Usuário tira a foto → cria-se um registro em `analises` (status `pendente`, depois `processado`), com `objeto_detectado` e `labels_json` vindos automaticamente da Cloud Vision (Object Localization + Label Detection, na mesma chamada).
2. Ainda na tela dessa análise, existe um botão **opcional** "Ler texto (OCR)". Se o usuário tocar:
   - A mesma foto é enviada à Cloud Vision, agora pedindo Text Detection.
   - O texto bruto retornado é salvo em `analises.texto_ocr` — pertence à análise, não ao item ainda.
3. Na tela de revisão/confirmação, o app mostra nome, tags e (se existir) o texto do OCR como sugestões editáveis, e um campo vazio de **categoria** para o usuário preencher manualmente.
4. Ao tocar em "Salvar no inventário" (confirmação final), os dados são **copiados** de `analises` para um novo registro em `itens_inventario` (ou usados para atualizar um existente, ver abaixo):
   - `nome` ← `objeto_detectado`, `tags_json` ← `labels_json`, `descricao` ← `texto_ocr` — todos editáveis a partir daqui, podem divergir do valor original da análise. `categoria` não tem origem automática — é preenchida pelo usuário nesse momento.
   - `identificador_ocr` ← cópia fixa de `texto_ocr` (só se existir), nunca aparece na tela, serve só para comparação interna.
5. Checagem de duplicado no momento da confirmação:
   - Se `identificador_ocr` não é nulo **e** bate com o `identificador_ocr` de um item já existente → entende-se que é o mesmo item físico → **atualiza** o item existente (incrementa `quantidade`, atualiza `atualizado_em`), não cria duplicado.
   - Caso contrário (sem OCR, ou texto não bate com nenhum item existente) → **cria um novo item** em `itens_inventario`, vinculado à análise de origem via `analise_origem_id`.
6. Quando não há `identificador_ocr` disponível para comparar, o app não tenta adivinhar duplicado por imagem — apenas mostra, se quiser, uma **contagem informativa por categoria/nome** via `COUNT` agrupado no banco. Isso é só estatística, não identificação de item repetido.

---

## 7. Mapeamento com os critérios de avaliação

| Critério | Como o projeto atende |
|---|---|
| Uso correto do Expo SQLite (2,0 pts) | Armazenamento local de `analises` e `itens_inventario`, fila offline, status de sincronização |
| Integração com Supabase (2,0 pts) | Espelhamento das tabelas, upsert automático ao reconectar, RLS por usuário |
| Resolve problema real (2,0 pts) | Inventário sem código de barras, com diferenciação por OCR entre itens do mesmo tipo |
| Visão computacional funcionando (4,0 pts) | Detecção de objeto + categorização + OCR complementar via Google Cloud Vision API |

---

## 8. Próximos passos (setup)

A definir no próximo documento/etapa: instalação do Node/Expo CLI, criação de conta e chave na Google Cloud Vision, criação de projeto no Supabase, estrutura de pastas do app, e teste no celular via Expo Go.
