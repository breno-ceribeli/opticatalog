# Google Cloud Vision API — Guia de Integração

## Visão Geral
API REST para visão computacional. Usada no app para:
- **LABEL_DETECTION** — tags descritivas da imagem inteira (ex: "Chair", "Furniture", "Wood")
- **OBJECT_LOCALIZATION** — objetos discretos com posição (bounding box) e nome
- **TEXT_DETECTION** — OCR (texto visível na imagem)

**Endpoint único:** `POST https://vision.googleapis.com/v1/images:annotate?key=API_KEY`

---

## Autenticação
- Chave de API direta no app (MVP) — `EXPO_PUBLIC_GOOGLE_VISION_API_KEY`
- Header: `Content-Type: application/json`
- Parâmetro de query: `?key=SUA_CHAVE`

---

## Formato da Requisição (Base64)

```json
{
  "requests": [
    {
      "image": {
        "content": "BASE64_ENCODED_IMAGE"
      },
      "features": [
        { "type": "LABEL_DETECTION", "maxResults": 5 },
        { "type": "OBJECT_LOCALIZATION", "maxResults": 1 }
      ]
    }
  ]
}
```

**Pontos-chave:**
- `image.content` = string base64 **sem prefixo** `data:image/jpeg;base64,`
- `features` = array — **pode pedir múltiplas features na mesma chamada** (recomendado para economizar quota e latência)
- `maxResults` = opcional (padrão 10). Não se aplica a TEXT_DETECTION.
- **LABEL_DETECTION:** `maxResults: 5` (suficiente para tags úteis)
- **OBJECT_LOCALIZATION:** `maxResults: 1` (queremos apenas o objeto principal — o de maior confiança; a API retorna ordenado por score desc)

---

## Conversão de Imagem Local → Base64 (React Native / Expo)

```typescript
import * as FileSystem from "expo-file-system/legacy";

async function imageToBase64(uri: string): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return base64;
}
```

---

## Resposta — LABEL_DETECTION

```json
{
  "responses": [
    {
      "labelAnnotations": [
        {
          "mid": "/m/01c8br",
          "description": "Chair",
          "score": 0.92,
          "topicality": 0.92
        },
        {
          "mid": "/m/06pg22",
          "description": "Furniture",
          "score": 0.87,
          "topicality": 0.87
        }
      ]
    }
  ]
}
```

**Campos úteis:**
- `description` — nome legível da label (usar como tags)
- `score` — confiança 0–1 (filtrar `< 0.5` se quiser)
- `topicality` — relevância no contexto da imagem
- `mid` — ID do Knowledge Graph (opcional, para enriquecimento futuro)

---

## Resposta — OBJECT_LOCALIZATION

```json
{
  "responses": [
    {
      "localizedObjectAnnotations": [
        {
          "mid": "/m/01bqk0",
          "name": "Bicycle wheel",
          "score": 0.89648587,
          "boundingPoly": {
            "normalizedVertices": [
              { "x": 0.32076266, "y": 0.78941387 },
              { "x": 0.43812272, "y": 0.78941387 },
              { "x": 0.43812272, "y": 0.97331065 },
              { "x": 0.32076266, "y": 0.97331065 }
            ]
          }
        },
        {
          "mid": "/m/0199g",
          "name": "Bicycle",
          "score": 0.886761,
          "boundingPoly": {
            "normalizedVertices": [
              { "x": 0.312, "y": 0.6616471 },
              { "x": 0.638353, "y": 0.6616471 },
              { "x": 0.638353, "y": 0.9705882 },
              { "x": 0.312, "y": 0.9705882 }
            ]
          }
        }
      ]
    }
  ]
}
```

**Importante:** Coordenadas com valor `0` são **omitidas** na resposta.
Ex: bounding box na imagem toda vem como `[{}, {"x": 1}, {"x": 1, "y": 1}, {"y": 1}]`.
Tratar ausência de `x`/`y` como `0` ao desserializar.

**Campos úteis:**
- `name` — nome do objeto detectado (usar como `objeto_detectado` principal)
- `score` — confiança 0–1
- `boundingPoly.normalizedVertices` — coordenadas normalizadas 0–1 (relativas à largura/altura da imagem)

**Regra de negócio:** usar **apenas o objeto de maior score** (o mais evidente). Descartar os demais.

---

## Resposta — TEXT_DETECTION (OCR)

```json
{
  "responses": [
    {
      "textAnnotations": [
        {
          "locale": "pt",
          "description": "NÚMERO DE SÉRIE\nABC123XYZ\n",
          "boundingPoly": {
            "vertices": [
              { "x": 100, "y": 200 },
              { "x": 500, "y": 200 },
              { "x": 500, "y": 300 },
              { "x": 100, "y": 300 }
            ]
          }
        },
        {
          "description": "NÚMERO DE SÉRIE",
          "boundingPoly": { "vertices": [...] }
        },
        {
          "description": "ABC123XYZ",
          "boundingPoly": { "vertices": [...] }
        }
      ],
      "fullTextAnnotation": {
        "pages": [...],
        "text": "NÚMERO DE SÉRIE\nABC123XYZ\n"
      }
    }
  ]
}
```

**Importante:** Coordenadas com valor `0` são **omitidas** na resposta (mesmo comportamento do Object Localization).
A resposta traz `vertices` com coordenadas em **pixels absolutos** (não normalizados 0–1).

**Campos úteis:**
- `textAnnotations[0].description` — **texto completo** da imagem (tudo junto, com `\n` para quebras de linha). Este é o campo principal para usar como `texto_ocr`.
- `textAnnotations[1+]` — palavras/linhas individuais com bounding boxes (útil para debug ou UI futura).
- `fullTextAnnotation.text` — mesmo texto completo, mas com estrutura hierárquica (pages → blocks → paragraphs → words → symbols).
- `locale` — idioma detectado (ex: "pt", "en").

**Regra de negócio:** usar **apenas `textAnnotations[0].description`** como texto bruto do OCR. Salvar em `analises.texto_ocr` e copiar para `itens_inventario.descricao` e `itens_inventario.identificador_ocr` na confirmação.

---

## Requisição — TEXT_DETECTION (OCR)

Pode ser chamado **sozinho** (botão "Ler texto" na revisão) ou **combinado** com Label + Object:

```json
{
  "requests": [
    {
      "image": { "content": "BASE64_ENCODED_IMAGE" },
      "features": [
        { "type": "LABEL_DETECTION", "maxResults": 5 },
        { "type": "OBJECT_LOCALIZATION", "maxResults": 1 },
        { "type": "TEXT_DETECTION" }
      ]
    }
  ]
}
```

**Pontos-chave:**
- `TEXT_DETECTION` **não aceita `maxResults`** — retorna todo texto detectado.
- Custo: 1 unidade por imagem (mesmo quota das outras features).
- Para OCR de documentos densos, existe `DOCUMENT_TEXT_DETECTION` (mais preciso, mesma quota), mas `TEXT_DETECTION` é suficiente para etiquetas/numerações de série.
- **OCR é chamado separadamente** (botão "Ler texto" na revisão), não na chamada combinada inicial — economiza quota e só gasta quando usuário solicita.

---

## Requisição Separada — TEXT_DETECTION (OCR sob demanda)

Chamada independente quando usuário toca "Ler texto" na revisão:

```typescript
async function lerTextoOcr(base64: string): Promise<string | null> {
  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64 },
            features: [{ type: "TEXT_DETECTION" }],
          },
        ],
      }),
    }
  );

  const data = await response.json();
  const annotation = data.responses?.[0];

  // textAnnotations[0] = texto completo da imagem
  return annotation?.textAnnotations?.[0]?.description ?? null;
}
```

---

## Chamada Combinada (Recomendada — Label + Object)

**Uma única requisição HTTP** para LABEL_DETECTION + OBJECT_LOCALIZATION (sem OCR):

```typescript
async function analisarImagem(base64: string) {
  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64 },
            features: [
              { type: "LABEL_DETECTION", maxResults: 5 },
              { type: "OBJECT_LOCALIZATION", maxResults: 1 },
            ],
          },
        ],
      }),
    }
  );

  const data = await response.json();
  const annotation = data.responses?.[0];

  // Labels: pegar top 5 com score >= 0.5
  const labels = annotation?.labelAnnotations
    ?.filter((l: any) => l.score >= 0.5)
    .slice(0, 5)
    .map((l: any) => ({ name: l.description, score: l.score })) ?? [];

  // Object: já vem apenas 1 (o de maior score)
  const object = annotation?.localizedObjectAnnotations?.[0];
  const objetoPrincipal = (object?.score ?? 0) >= 0.5
    ? object.name
    : labels[0]?.name ?? "Objeto não identificado";

  return { objetoPrincipal, labels };
}
```

---

## Tratamento de Erros

| Código | Significado | Ação |
|--------|-------------|------|
| 400 | Requisição inválida (base64 malformado, imagem muito grande) | Validar antes de enviar |
| 401/403 | Chave inválida / sem permissão / billing desativado | Verificar console Google Cloud |
| 429 | Quota excedida | Backoff exponencial, retry |
| 500/503 | Erro interno do Google | Retry com backoff |

**Limites gratuitos:** 1.000 unidades/mês por feature (Label + Object = 2 unidades por imagem; OCR adiciona +1 quando chamado separadamente)

---

## Checklist de Integração no App

- [ ] Ler arquivo local → base64 (`FileSystem.readAsStringAsync`)
- [ ] **Chamada inicial (captura):** montar request com `features: [LABEL_DETECTION (maxResults: 5), OBJECT_LOCALIZATION (maxResults: 1)]`
- [ ] Enviar `fetch` com API key do `.env`
- [ ] Extrair `objetoPrincipal` = object retornado (já vem como maior score), score >= 0.5; fallback para primeira label
- [ ] Extrair `labels[]` (top 5, description + score, score >= 0.5) → serializar JSON para `labels_json`
- [ ] Atualizar `analises` no SQLite: `objeto_detectado`, `labels_json`, `status: 'processado'`
- [ ] **OCR sob demanda (botão "Ler texto"):** chamada separada `TEXT_DETECTION` → extrair `textAnnotations[0].description` → salvar em `analises.texto_ocr` e preencher `descricao` na UI
- [ ] Tratar `normalizedVertices` ausentes como `0` (coordenadas omitidas quando zero)
- [ ] Tratar erro de rede → `status: 'erro'` (permitir retry manual)
- [ ] **Checar conectividade antes** (`NetInfo`) — se offline, deixar `pendente` para sync posterior