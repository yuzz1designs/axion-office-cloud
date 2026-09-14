# AXION OFFICE

Protótipo local do AXION OFFICE para CRM, depósito de documentos e ferramentas internas.

## Correr localmente

**Pré-requisitos:** Node.js 22.

1. Instalar dependências:

   ```bash
   npm install
   ```

2. Criar `.env` ou `.env.local` a partir de [.env.example](.env.example).

3. Arrancar o servidor local:

   ```bash
   npm run dev
   ```

4. Abrir:

   ```text
   http://localhost:3000
   ```

## Google Sheets e Drive

O backend usa credenciais apenas do servidor. Nunca criar variáveis com prefixo `VITE_` para chaves privadas, tokens ou secrets, porque variáveis `VITE_` são expostas ao browser.

### CRM via Google Sheets

Configurar no `.env`:

```env
GOOGLE_SHEETS_ID=...
GOOGLE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Em alternativa, para desenvolvimento local:

```env
GOOGLE_SERVICE_ACCOUNT_FILE=/absolute/path/to/service-account.json
```

### Depósito de documentos

A listagem lê a pasta Google Drive `DOCS` configurada em:

```env
GOOGLE_DRIVE_DOCS_FOLDER_ID=1_Xtah1WKj_YoxZoOjNABiM0TjuWBvef8
```

Uploads para uma conta Google normal precisam de OAuth local, porque Service Accounts não têm quota própria para guardar ficheiros em My Drive.

## OAuth Google local para uploads

Este fluxo é apenas para `localhost`. Antes de produção, substituir por autenticação AXION real, callbacks HTTPS, tokens encriptados, auditoria, revogação e permissões por utilizador/organização.

1. Abrir a Google Cloud Console no projeto que tem acesso ao Drive.

2. Ativar a Google Drive API.

3. Configurar o OAuth consent screen:

   - Tipo: `External`, se for uma conta Google normal.
   - Publishing status: `Testing` enquanto for local.
   - Test users: adicionar o email Google que vai fazer upload.

4. Criar credenciais OAuth:

   - Tipo: `OAuth client ID`.
   - Application type: `Web application`.
   - Authorized JavaScript origins:

     ```text
     http://localhost:3000
     ```

   - Authorized redirect URIs:

     ```text
     http://localhost:3000/api/google/oauth/callback
     ```

5. Adicionar ao `.env` local:

   ```env
   GOOGLE_OAUTH_CLIENT_ID=...
   GOOGLE_OAUTH_CLIENT_SECRET=...
   GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/google/oauth/callback
   ```

6. Reiniciar o servidor:

   ```bash
   npm run dev
   ```

7. No AXION OFFICE, abrir o depósito de documentos e carregar em `Ligar Google Drive`.

8. Depois do consentimento Google, o upload envia ficheiros até 50 MB diretamente para a pasta `DOCS`.

O grant OAuth fica guardado apenas localmente em `.axion-local/google-oauth.json`, ignorado pelo Git e criado com permissões restritas. Não enviar esse ficheiro nem os valores do `.env` por chat.

## Google Calendar e Tasks por perfil

Calendar e Tasks usam uma autorização diferente da ligação central do Drive. Na Google Cloud Console:

1. Ativar `Google Calendar API` e `Google Tasks API`.
2. Adicionar os scopes de eventos do Calendar e Google Tasks ao consentimento OAuth.
3. Adicionar este redirect URI autorizado:

   ```text
   http://localhost:3000/api/google/workspace/oauth/callback
   ```

Cada operador configura primeiro o perfil AXION e depois liga a sua conta em `Perfil > Permissões & Acessos` ou na área de calendário. No primeiro sync é criada, se necessário, uma lista Google Tasks chamada `AXION OFFICE`. Os grants individuais ficam em `.axion-local/google-workspace.json`; a ligação do Drive não é alterada.

## Backend Supabase

O schema inicial está em `supabase/migrations/20260903190000_axion_foundation.sql`. Para ativar o backend partilhado, cria um projeto Supabase, ativa o provider Google em Authentication e configura:

```env
SUPABASE_URL=https://PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_PUBLISHABLE_KEY=...
AXION_ALLOWED_EMAILS=nelsonafonsoprofissional@gmail.com,eduardo04ssousa@gmail.com
```

Aplica a migração com `npx supabase link` e `npx supabase db push`. Sem estas variáveis o localhost mantém automaticamente o armazenamento local atual.

O `SUPABASE_SERVICE_ROLE_KEY` fica exclusivamente no servidor. O login Google do Supabase trata apenas da identidade; os tokens de Calendar, Tasks e Drive continuam controlados pelo backend AXION.

## Comandos úteis

```bash
npm test
npm run lint
npm run build
```
