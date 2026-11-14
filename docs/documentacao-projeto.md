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
3. **Checagem de duplicados por OCR (planejada)** — usar o texto lido para comparar registros. No fluxo atual, o OCR auxilia o preenchimento da descrição.
4. **Filtros por categoria e tags** — o inventário pode ser filtrado pelos dados do cadastro.
5. **Edição manual** — nome e tags sugeridos pela IA são um ponto de partida editável; a categoria é sempre definida manualmente pelo usuário (sem sugestão automática) antes de confirmar o lançamento no inventário.
6. **Histórico de análises** — toda captura fica registrada, mesmo repetidas.
7. **Inventário** — lista de itens cadastrados com quantidade, categoria e descrição.
8. **Armazenamento local com operação offline** — fotos confirmadas sem conexão ficam com a análise pendente. Após reconectar, o app dispara a sincronização de registros. A análise da imagem pendente pode ser acionada pelo histórico.

---

## 3. Fluxo de uso

```
Tirar foto
   → Salvar no SQLite (status: pendente)
      → [sem internet: fica na fila]
      → [com internet] Enviar para Cloud Vision (objeto + tags)
         → Usuário revisa/edita nome e tags, define a categoria manualmente
         → (opcional) Botão "Ler texto" → OCR via Cloud Vision → preenche Descrição
         → Usuário confirma os dados revisados e salva o item no inventário
      → Sincroniza com Supabase
```

**Importante:** a análise e o OCR dependem de internet. A captura e o armazenamento funcionam localmente quando não há conexão.

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

**Princípio importante:** o `id` de cada registro é gerado no app e reaproveitado no SQLite e no Supabase. A sincronização usa esse identificador para fazer upsert do mesmo registro.

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
- `identificador_ocr` (nullable — campo reservado para a futura checagem de duplicados. O fluxo atual aproveita o texto na descrição editável)
- `imagem_uri` (nullable — **campo local apenas**, caminho da imagem baixada do Supabase Storage; usado para thumbnail no card do item; não é sincronizado com o Supabase)
- `quantidade`
- `criado_em`
- `atualizado_em`
- `sincronizado` (INTEGER 0/1)

### Supabase (PostgreSQL, nuvem)

Espelha as duas tabelas locais com adaptções para PostgreSQL. O `id` sempre chega já preenchido do app (client-side). **Não existe `user_id`** — todas as tabelas têm acesso irrestrito (política de "acesso total") para simplificar o MVP de faculdade. RLS está habilitado mas com policy `USING (true) WITH CHECK (true)`.

**SQL completo das tabelas Supabase:**

```sql
-- Tabela de análises (raw da Cloud Vision)
create table analises (
  id uuid primary key,
  imagem_url text,                         -- preenchida na sincronização (Supabase Storage)
  objeto_detectado text,                   -- da Object Localization
  labels jsonb,                            -- da Label Detection: [{"label":"Cat","score":0.98},...]
  texto_ocr text,                          -- preenchido só se OCR foi usado
  status text default 'pendente',
  criado_em timestamp default now()
);

-- Tabela de itens do inventário
create table itens_inventario (
  id uuid primary key,
  analise_origem_id uuid references analises(id),
  nome text not null,
  categoria text,
  tags jsonb,
  descricao text,
  identificador_ocr text,
  quantidade integer default 1,
  criado_em timestamp default now(),
  atualizado_em timestamp default now()
);

-- RLS (acesso total — projeto de faculdade, sem isolamento por usuário)
alter table analises enable row level security;
alter table itens_inventario enable row level security;
create policy "acesso total (projeto de faculdade)" on analises for all using (true) with check (true);
create policy "acesso total (projeto de faculdade)" on itens_inventario for all using (true) with check (true);
```

**Diferenças em relação ao SQLite local (mapeamento na sincronização):**

| Coluna local (SQLite) | Coluna remota (Supabase) | Tipo local → remoto | Observação |
|---|---|---|---|
| `imagem_uri` | `imagem_url` | TEXT → text | Local = caminho do arquivo; Remoto = URL do Storage |
| `labels_json` | `labels` | TEXT (JSON serializado) → jsonb | Nome + tipo diferentes |
| `tags_json` | `tags` | TEXT (JSON serializado) → jsonb | Nome + tipo diferentes |
| `sincronizado` | *não existe* | INTEGER 0/1 → — | Campo auxiliar local, não vai para o Supabase |
| `imagem_uri` (itens) | *não existe* | TEXT → — | Campo local apenas, para thumbnail; não sincroniza |
| `criado_em` | `criado_em` | INTEGER (epoch ms) → timestamp | Conversão: `new Date(epoch).toISOString()` |
| `atualizado_em` | `atualizado_em` | INTEGER (epoch ms) → timestamp | Idem |
| `categoria` (NOT NULL) | `categoria` (nullable) | — | SQLite exige; Supabase permite nulo |

### 5.1 — Armazenamento das imagens

- **Local:** a foto capturada é salva como arquivo permanente no celular via `expo-file-system` (não na pasta de cache), redimensionada/comprimida antes de salvar (ex: `expo-image-manipulator`, máx. ~1280px de largura). O caminho desse arquivo é o que fica em `analises.imagem_uri` no SQLite.
- **Remoto:** um caminho de arquivo local não significa nada fora do próprio celular. Na sincronização, o arquivo é enviado a um bucket do **Supabase Storage** (`fotos-inventario`), e a URL pública resultante é salva em `analises.imagem_url` na tabela remota.
- **`itens_inventario.imagem_uri`** — campo local apenas, copiado da análise ao criar o item, ou preenchido ao baixar item remoto do Supabase. Não é sincronizado com o Supabase. Usado para exibir thumbnail no card do item.
- **Download de itens remotos:** ao baixar um item do Supabase, o app busca a `imagem_url` da análise deorigem, baixa a imagem via `FileSystem.downloadAsync()` e salva localmente em `itens_inventario.imagem_uri`.

### Lógica de sincronização

A cada mudança de conectividade (via `NetInfo`) ou ação manual do usuário:
1. Busca registros locais com `sincronizado = false` em ambas as tabelas.
2. Para registros de `analises` pendentes: faz upload da imagem para o Supabase Storage, obtém a `imagem_url`.
3. Faz upsert no Supabase (tabelas + imagem) usando o mesmo `id` gerado localmente.
4. Marca como `sincronizado = true` após confirmação.

---

## 6. Fluxo de OCR e evolução planejada

Passo a passo de como o OCR se encaixa, do zero:

1. Usuário tira a foto → cria-se um registro em `analises` (status `pendente`, depois `processado`), com `objeto_detectado` e `labels_json` vindos automaticamente da Cloud Vision (Object Localization + Label Detection, na mesma chamada).
2. Ainda na tela dessa análise, existe um botão **opcional** "Ler texto (OCR)". Se o usuário tocar:
   - A mesma foto é enviada à Cloud Vision, agora pedindo Text Detection.
   - O texto bruto retornado é salvo em `analises.texto_ocr` — pertence à análise, não ao item ainda.
3. Na tela de revisão/confirmação, o app mostra nome, tags e (se existir) o texto do OCR como sugestões editáveis, e um campo vazio de **categoria** para o usuário preencher manualmente.
4. Ao tocar em "Salvar no inventário", o app grava os valores revisados em `itens_inventario`. O campo `analise_origem_id` preserva o vínculo com a análise original.

A checagem futura de duplicados poderá comparar identificadores lidos por OCR entre itens. O cadastro atual não realiza essa comparação.

---

## 7. Mapeamento com os critérios de avaliação

| Critério | Como o projeto atende |
|---|---|
| Uso correto do Expo SQLite (2,0 pts) | Armazenamento local de `analises` e `itens_inventario`, fila offline, status de sincronização |
| Integração com Supabase (2,0 pts) | Espelhamento das tabelas, upsert automático ao reconectar, RLS habilitado (sem isolamento por usuário nesta versão) |
| Resolve problema real (2,0 pts) | Inventário sem código de barras, com diferenciação por OCR entre itens do mesmo tipo |
| Visão computacional funcionando (4,0 pts) | Sugestões de nome e tags e OCR complementar via Google Cloud Vision API |

---

## 8. Configuração local

As instruções de instalação e as variáveis necessárias estão no [README](../README.md#como-executar).
