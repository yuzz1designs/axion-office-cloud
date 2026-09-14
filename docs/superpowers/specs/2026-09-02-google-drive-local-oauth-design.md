# Google Drive OAuth local para uploads no Depósito de Documentos

## Objetivo

Permitir que o AXION OFFICE em `http://localhost:3000` carregue ficheiros para a pasta existente `AXION / DOCS` de uma conta Google normal. A listagem read-only já funciona através da conta de serviço, mas uploads falham porque contas de serviço não possuem quota de armazenamento em My Drive.

Esta fase serve exclusivamente o protótipo local. A autenticação Google aqui descrita não substitui a futura autenticação dos utilizadores do AXION OFFICE.

## Âmbito

Incluído:

- ligação OAuth de uma única conta Google em localhost;
- callback OAuth no backend local;
- persistência local do refresh token fora do Git;
- estado de ligação consultável pelo frontend;
- upload de um ficheiro de cada vez, até 50 MB, para a pasta `DOCS` existente;
- progresso browser → backend;
- atualização automática da listagem após upload;
- possibilidade de desligar/revogar a ligação local;
- mensagens claras para configuração, consentimento, expiração e falhas do Google.

Excluído:

- login no AXION OFFICE com Google;
- múltiplos utilizadores ou múltiplas contas Google;
- deployment de produção;
- Google Picker;
- gestão de subpastas;
- upload resumível ou ficheiros acima de 50 MB;
- partilha, eliminação e alteração de permissões pelo AXION OFFICE.

## Fluxo do utilizador

1. O Depósito consulta `GET /api/google/oauth/status`.
2. Sem ligação, o botão de upload explica que é necessário ligar uma conta e apresenta `Ligar Google Drive`.
3. `GET /api/google/oauth/start` cria um valor `state` aleatório, guarda-o temporariamente no servidor e redireciona para o consentimento Google.
4. O Google regressa a `GET /api/google/oauth/callback`.
5. O backend valida `state`, troca o código por tokens, confirma a identidade e guarda apenas os dados necessários.
6. O callback redireciona para `/?google-drive=connected`; o Depósito volta a consultar o estado.
7. O utilizador seleciona ou arrasta um ficheiro. O browser envia o binário para `POST /api/documents/upload`.
8. O backend obtém um access token válido através do refresh token, envia o ficheiro para `AXION / DOCS` e só responde com sucesso após confirmação do Drive.
9. A interface volta a listar a pasta e apresenta o novo ficheiro.

## Configuração Google Cloud

Será criado um OAuth Client do tipo Web application no mesmo projeto Google Cloud, com:

- origem JavaScript autorizada: `http://localhost:3000`;
- redirect URI: `http://localhost:3000/api/google/oauth/callback`;
- aplicação em modo Testing;
- conta Google AXION adicionada como test user;
- Google Drive API ativa.

Variáveis locais:

```text
GOOGLE_OAUTH_CLIENT_ID
GOOGLE_OAUTH_CLIENT_SECRET
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/google/oauth/callback
GOOGLE_DRIVE_DOCS_FOLDER_ID=1_Xtah1WKj_YoxZoOjNABiM0TjuWBvef8
```

Valores reais ficam em `.env`, nunca em variáveis `VITE_`, commits, logs ou respostas da API.

## Scopes e consentimento

O protótipo pedirá `https://www.googleapis.com/auth/drive`, porque precisa escrever numa pasta My Drive existente que não foi criada nem selecionada pela aplicação. O consentimento será limitado ao único test user configurado.

Este scope amplo é uma decisão temporária para localhost. Antes de produção será obrigatório avaliar Google Picker + `drive.file` e consentimento incremental.

## Backend

Será criado um módulo OAuth separado do adapter Drive:

- `googleOAuthApi`: start, callback, status e disconnect;
- `googleOAuthStore`: leitura/escrita atómica do grant local;
- `googleOAuthClient`: troca e refresh de tokens;
- `googleDriveApi`: listagem e upload usando o grant OAuth quando escreve.

O estado OAuth será de uso único, terá expiração curta e será validado antes da troca do código. O refresh token nunca será devolvido ao browser.

O grant local será guardado em `.axion-local/google-oauth.json`, com diretório e ficheiro ignorados pelo Git e permissões restritas ao utilizador do sistema. O ficheiro conterá refresh token, email autorizado, scopes e timestamps. Access tokens poderão permanecer apenas em memória.

## API local

```text
GET  /api/google/oauth/status
GET  /api/google/oauth/start
GET  /api/google/oauth/callback
POST /api/google/oauth/disconnect
POST /api/documents/upload
GET  /api/documents
```

`status` devolve apenas `connected`, email, scopes necessários em falta e data da ligação. `disconnect` remove o grant local e tenta revogá-lo no Google. O upload aceita um corpo binário, nome codificado no cabeçalho e tipo MIME, mantendo o limite de 50 MB.

## Segurança local

- client secret e tokens exclusivamente no backend;
- validação de `state` para impedir callback forjado;
- `Cache-Control: no-store` nos endpoints OAuth;
- nomes de ficheiro validados e nunca usados como caminhos locais;
- limite aplicado durante a leitura do corpo, não apenas depois;
- erros externos normalizados sem devolver tokens;
- logs sem credenciais, códigos OAuth ou conteúdo dos documentos;
- pasta e ficheiro de grant ignorados pelo Git;
- nenhuma escrita fora da pasta `DOCS` configurada.

Como o AXION OFFICE ainda não tem autenticação própria, estes endpoints destinam-se apenas a localhost. Não devem ser expostos publicamente.

## Interface

O modal de upload mantém drag-and-drop, seleção de um ficheiro, tamanho, progresso e erros. Quando não existe grant OAuth, substitui a ação final por `Ligar Google Drive`. Quando existe, mostra discretamente a conta ligada e oferece `Desligar` nas opções da ligação.

O Depósito continua a apresentar apenas metadados reais. A abertura de ficheiros usa o `webViewLink` oficial do Google Drive.

## Erros e recuperação

- configuração OAuth ausente: instrução para preencher as variáveis locais;
- callback recusado/cancelado: regresso ao Depósito com mensagem não destrutiva;
- refresh token inválido ou revogado: grant marcado como desligado e novo consentimento solicitado;
- scope insuficiente: ligação rejeitada com indicação explícita;
- pasta inacessível: upload não começa e a listagem mantém o último estado conhecido;
- upload interrompido: modal preserva o ficheiro para nova tentativa;
- resposta do Drive sem ficheiro confirmado: operação apresentada como falhada.

## Testes e aceitação

Testes automatizados:

- geração e consumo único de `state`;
- rejeição de state ausente, incorreto ou expirado;
- persistência do grant sem expor tokens na resposta;
- refresh de access token;
- validação de ficheiros vazios e superiores a 50 MB;
- upload usa sempre o ID da pasta `DOCS`;
- erros Google são normalizados.

Aceitação real em localhost:

1. ligar a conta Google AXION;
2. carregar um ficheiro temporário pequeno;
3. confirmar o ficheiro na listagem da dashboard e na pasta Drive;
4. eliminar manualmente apenas o ficheiro temporário;
5. desligar e voltar a ligar a conta;
6. confirmar que `.env` e `.axion-local` não estão preparados para commit.

## Migração obrigatória antes de produção

Esta implementação local não deve ser promovida diretamente. A versão de produção exigirá:

- autenticação real AXION e associação do grant a `User`, `Organization` e `IntegrationConnection`;
- refresh tokens encriptados em base de dados ou secret manager;
- callbacks HTTPS no domínio oficial;
- sessões, CSRF e autorização por Partner;
- rotação/revogação e auditoria de grants;
- política de retenção e logs estruturados;
- avaliação/verificação OAuth pela Google;
- scopes incrementais e preferência por Picker + `drive.file`;
- tratamento de concorrência, jobs e uploads resumíveis;
- testes de segurança e threat model atualizado.
