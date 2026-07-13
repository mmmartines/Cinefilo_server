# Cinefilo Server 🎬

Este é o backend (API) para o aplicativo Cinéfilo, hospedado na Vercel utilizando funções Serverless (`@vercel/node`). Ele é responsável pela sincronização em nuvem e pela integração com o banco de dados (Astra DB / Supabase).

## Funcionalidades
- **Autenticação Segura:** Validação de JWT via cabeçalho `Authorization` do Supabase.
- **Sincronização de Estatísticas:** Registra o progresso do usuário no Astra DB.
- **Sistema de Amigos:** Adição de amigos por `#Tag` gerada automaticamente. Ranking social e sistema Gamificado com base no tempo assistido.

## Instalação e Uso Local

1. Clone o repositório
2. Instale as dependências com `npm install`
3. Renomeie ou crie um arquivo `.env` com as seguintes chaves:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `ASTRA_DB_API_ENDPOINT`
   - `ASTRA_DB_APPLICATION_TOKEN`
4. Rode localmente usando a Vercel CLI: `vercel dev`

## Deploy

Este projeto está pré-configurado para deploy rápido na [Vercel](https://vercel.com).
Basta importar o repositório e configurar as variáveis de ambiente no Dashboard da Vercel.
