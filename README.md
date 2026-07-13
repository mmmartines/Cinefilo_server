# 🎬 Cinéfilo — Server

> **API Serverless do Cinéfilo**, hospedada na Vercel. Responsável por operações seguras no servidor: sincronização de dados, sistema social, notificações push, inteligência artificial e gerenciamento de usuários.

---

## 📡 Endpoints da API

| Método | Rota | Descrição |
|---|---|---|
| `GET/POST/DELETE` | `/api/users` | Gerenciamento do perfil do usuário |
| `GET` | `/api/me` | Dados do usuário autenticado |
| `GET` | `/api/feed` | Feed de atividades dos amigos |
| `GET/POST` | `/api/friends` | Lista e adiciona amigos por #Tag |
| `GET/POST/DELETE` | `/api/friend_requests` | Pedidos de amizade (enviar, aceitar, recusar) |
| `GET/POST/DELETE` | `/api/lists` | Listas customizadas |
| `GET/POST/DELETE` | `/api/list_movies` | Filmes dentro de uma lista |
| `GET` | `/api/list_share` | Compartilhamento público de listas |
| `POST` | `/api/sync` | Sincronização de filmes assistidos |
| `POST` | `/api/notify` | Envio de notificações push (Expo) |
| `GET` | `/api/ai/recommend` | Recomendação de filmes via IA (Gemini) |

---

## 🔐 Autenticação

Todas as rotas (exceto `list_share`) requerem autenticação via **Supabase JWT**.

Envie o token no cabeçalho de cada requisição:
```
Authorization: Bearer <supabase_access_token>
```

O servidor valida o token diretamente contra o Supabase antes de processar qualquer requisição.

---

## 🧰 Stack Tecnológica

- **Node.js** com **TypeScript**
- **Vercel Serverless Functions** (`@vercel/node`)
- **Supabase** — Autenticação e banco de dados
- **Expo Server SDK** — Envio de Push Notifications
- **Google Gemini API** — Recomendações por IA

---

## 🚀 Como Executar Localmente

### Pré-requisitos
- Node.js 18+
- Vercel CLI (`npm install -g vercel`)
- Projeto no [Supabase](https://supabase.com) configurado

### Passo a passo

1. **Clone o repositório e acesse a pasta:**
   ```bash
   git clone <URL_DO_REPOSITORIO>
   cd Cinefilo/server
   ```

2. **Instale as dependências:**
   ```bash
   npm install
   ```

3. **Configure as variáveis de ambiente:**
   Crie um arquivo `.env` na raiz da pasta `server/` com:
   ```env
   SUPABASE_URL=https://xxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
   SUPABASE_ANON_KEY=sua_anon_key
   GEMINI_API_KEY=sua_chave_gemini
   ```
   > ⚠️ Use a `SERVICE_ROLE_KEY` (não a `anon_key`) para que o servidor tenha permissão de leitura/escrita irrestrita no banco.

4. **Inicie o servidor localmente:**
   ```bash
   vercel dev
   ```
   O servidor estará disponível em `http://localhost:3000`.

---

## ☁️ Deploy (Vercel)

O deploy é feito automaticamente ao fazer push para a branch principal, caso o repositório esteja conectado à Vercel.

Para deploy manual:
```bash
vercel --prod
```

**Lembre-se de configurar as variáveis de ambiente no Dashboard da Vercel** (Settings → Environment Variables) antes do primeiro deploy:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- `GEMINI_API_KEY`

---

## 📄 Licença
MIT — veja o arquivo [LICENSE](./LICENSE).
