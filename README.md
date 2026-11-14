# Opticatalog

## Integrantes do grupo

- Breno Fernandes Ceribeli
- Felipe Ribeiro Matsuguma
- Renan Silva Prado

## Sobre o projeto

O Opticatalog é um aplicativo móvel de inventário visual. Ele usa uma foto para sugerir o nome e as tags de um objeto e pode ler o texto de uma etiqueta para preencher a descrição. A pessoa revisa as sugestões, escolhe a categoria e confirma o cadastro. O projeto foi desenvolvido para uma disciplina de graduação.

## Apresentação e demonstração

[Baixar a apresentação do Opticatalog com vídeo incorporado](apresentacao/Opticatalog-Apresentacao-Visual-Com-Video.pptx)

Abra o arquivo baixado no PowerPoint e inicie o modo de apresentação. A gravação do aplicativo está incorporada ao último slide.

## O que o app faz

1. Captura uma foto pela câmera ou seleciona uma imagem da galeria e salva a análise no aparelho.
2. Com conexão, consulta a Google Cloud Vision para identificar o objeto principal e sugerir tags. Na revisão, **Ler texto** aciona o OCR e aproveita o resultado na descrição.
3. Permite editar nome, tags e descrição, escolher a categoria manualmente e salvar o item no inventário.
4. Exibe o histórico de análises e permite consultar, editar e filtrar itens por categoria e tags. Também permite sincronizar registros e baixar itens da nuvem.

A captura, a consulta local e o cadastro podem ser feitos offline. Fotos salvas sem conexão ficam com a análise pendente. Ao reconectar, o app tenta sincronizar os registros com o Supabase. Para processar uma foto pendente, toque em **Analisar agora** no histórico. A detecção de duplicados por OCR está planejada.

## Arquitetura

| Componente | Responsabilidade |
| --- | --- |
| React Native, Expo SDK 54 e Expo Router | Interface, câmera, galeria e navegação |
| Expo SQLite e Expo FileSystem | Registros e fotos no aparelho |
| Google Cloud Vision | Object Localization e Label Detection na análise inicial, Text Detection no OCR sob demanda |
| Supabase | PostgreSQL para registros e Storage para as fotos |
| NetInfo | Verificação de conectividade e disparo da sincronização ao reconectar |

O SQLite separa o resultado da foto, na tabela `analises`, do cadastro revisado, em `itens_inventario`. O campo `analise_origem_id` liga o item à análise. Os IDs são gerados no app e reaproveitados no Supabase para inserir ou atualizar o mesmo registro. As imagens sincronizadas ficam no bucket `fotos-inventario`.

## Como executar

Use Node.js 20.19 ou superior e, no Android, instale uma versão do [Expo Go compatível com o SDK 54](https://expo.dev/go). O celular e o computador devem conseguir se comunicar pela rede local.

```bash
git clone https://github.com/breno-ceribeli/opticatalog.git
cd opticatalog
npm install
```

Copie [`.env.example`](.env.example) para `.env` e preencha os dados de seus próprios projetos:

| Variável | Valor esperado |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Chave pública do cliente Supabase, do tipo publishable ou anon |
| `EXPO_PUBLIC_GOOGLE_VISION_API_KEY` | Chave de um projeto Google Cloud com a Cloud Vision API habilitada |

No Supabase, crie as tabelas com o [SQL documentado](docs/documentacao-projeto.md#supabase-postgresql-nuvem) e configure o bucket público `fotos-inventario`. As políticas de Storage do ambiente de demonstração precisam permitir leitura, inserção, atualização e exclusão de objetos desse bucket pelo cliente. O protótipo acadêmico usa políticas abertas no ambiente de demonstração e a chave Vision fica no cliente. Use um projeto separado com dados de teste e mantenha o `.env` local fora do Git.

```bash
npm start
```

Abra o Expo Go e leia o QR Code do terminal. A análise de imagens, o OCR e a sincronização dependem da conexão com os serviços e das credenciais configuradas.

## Código e documentação

- [app/](app/) contém as telas de captura, revisão, histórico e inventário.
- [src/db/](src/db/) contém o schema e as consultas do SQLite.
- [src/services/](src/services/) contém a integração com a Cloud Vision e a sincronização com o Supabase.
- [Documentação do projeto](docs/documentacao-projeto.md), [guia da Cloud Vision](docs/cloud-vision-api.md) e [roteiro de desenvolvimento](docs/roadmap-desenvolvimento.md).

```bash
npm run lint
npx tsc --noEmit
```
