# Google Calendar e Tasks — desenho de sincronização

## Objetivo

Substituir a simulação da área “Reuniões & Calendário” por sincronização bidirecional real com o Google Calendar e Google Tasks de cada operador AXION. O Google Drive mantém a ligação central atual. Google Keep e Discord ficam fora desta fase.

## Âmbito

- Cada perfil AXION liga a sua própria conta Google para Calendar e Tasks.
- O calendário principal da conta ligada é sincronizado com o AXION.
- Cada conta recebe uma lista Google Tasks dedicada chamada `AXION OFFICE`.
- A sincronização ocorre automaticamente ao abrir a área e manualmente através do botão `Sync`.
- Eventos criados ou editados no AXION são enviados ao Google Calendar.
- Tarefas criadas, editadas ou concluídas no AXION são enviadas ao Google Tasks e vice-versa.
- Concluir tarefas aumenta as horas de foco do perfil.

## Fora do âmbito

- Google Keep: a API oficial é orientada a ambientes Google Workspace com administração do domínio, incompatível com a conta Gmail normal usada nesta fase.
- Discord, bot, atas, gravações, transcrições e extração automática de tarefas.
- Criação automática de tarefas a partir de reuniões.
- Migração do depósito de documentos para OAuth individual.
- Ligação de vários calendários ou listas pessoais além dos recursos definidos neste documento.

## Arquitetura

### Ligações Google independentes

A ligação OAuth central do Drive permanece inalterada. Calendar e Tasks usam um novo armazenamento de grants indexado pelo ID do perfil AXION. Cada grant contém apenas dados privados do servidor:

- refresh token;
- email Google ligado;
- scopes concedidos;
- data de ligação;
- ID da lista Google Tasks `AXION OFFICE`;
- token incremental do calendário.

Refresh tokens nunca são devolvidos ao browser nem incluídos no objeto público do perfil. No ambiente local, os ficheiros ficam em `.axion-local/`, com permissões restritas e ignorados pelo Git.

### Scopes

O novo consentimento solicita apenas identidade básica, edição de eventos e edição de tarefas:

- `openid`;
- `email`;
- `https://www.googleapis.com/auth/calendar.events`;
- `https://www.googleapis.com/auth/tasks`.

O consentimento Calendar/Tasks é separado do fluxo central do Drive para impedir regressões no depósito de documentos.

## Fluxos

### Ligação inicial

1. O utilizador abre “Reuniões & Calendário”.
2. Sem grant associado ao perfil, a interface mostra `Ligar Google Calendar & Tasks`.
3. O servidor inicia OAuth com um `state` descartável associado ao perfil atual.
4. No callback, valida o `state`, troca o código, confirma scopes e obtém o email Google.
5. Procura uma lista Google Tasks chamada `AXION OFFICE`; cria-a apenas se não existir.
6. Executa a sincronização inicial e apresenta o estado de cada serviço.

### Google Calendar

- A sincronização inicial importa os últimos 90 dias e os próximos 12 meses do calendário principal.
- O servidor percorre todas as páginas e guarda o `nextSyncToken` apenas após uma sincronização completa.
- Sincronizações seguintes usam o token incremental e incluem eventos cancelados para refletir remoções.
- Se o Google invalidar o token com HTTP `410`, o servidor descarta-o e repete uma sincronização completa.
- O mapeamento preserva IDs Google e AXION, título, descrição, datas, horas, fuso horário, participantes, estado e localização.
- Reuniões criadas no AXION não geram Google Meet. O link ou canal Discord pode ser inserido manualmente como localização.
- Alterações no AXION são enviadas imediatamente ao Google. Alterações remotas chegam no sync automático ou manual.
- Em conflito, prevalece a versão com `updatedAt` mais recente. O mapeamento de IDs impede duplicados após tentativas repetidas.

### Google Tasks

- Apenas a lista `AXION OFFICE` é sincronizada.
- O mapeamento preserva IDs Google e AXION, título, notas, data-limite, estado concluído e atualização.
- A API do Google Tasks não preserva hora na data-limite; `dueTime` continua a ser um dado local do AXION.
- Tarefas Google sem duração estimada recebem 30 minutos no AXION.
- Nenhuma tarefa é criada automaticamente a partir de uma reunião. A futura ação manual `Enviar para Google Tasks` pertence à fase Discord.
- Conflitos usam a versão com atualização mais recente e operações repetidas são idempotentes.

### Horas de foco

O perfil passa a guardar minutos de foco reais e um livro de movimentos por tarefa. Quando uma tarefa passa de pendente para concluída, é criado um movimento positivo igual à duração estimada ou 30 minutos. Se voltar a pendente, é criado o movimento inverso.

O identificador estável da tarefa torna o cálculo idempotente: importar ou sincronizar repetidamente uma tarefa já concluída não aumenta o total novamente. A página de perfil converte o total acumulado para horas e substitui o valor fictício atual.

## Persistência local

Um armazenamento por perfil mantém:

- grant OAuth Calendar/Tasks;
- estado público da ligação;
- eventos e tarefas normalizados;
- mapeamentos entre IDs AXION e Google;
- token incremental do Calendar;
- último resultado de sync por serviço;
- livro de movimentos de foco.

As escritas são atómicas. Uma falha num serviço não elimina dados válidos do outro serviço nem o cache local anterior.

## API interna

Endpoints previstos, todos associados ao perfil atual através do cookie do perfil:

- `GET /api/google/workspace/status`;
- `GET /api/google/workspace/oauth/start`;
- `GET /api/google/workspace/oauth/callback`;
- `POST /api/google/workspace/disconnect`;
- `POST /api/google/workspace/sync`;
- `GET /api/google/workspace/calendar/events`;
- `POST/PATCH /api/google/workspace/calendar/events`;
- `GET /api/google/workspace/tasks`;
- `POST/PATCH /api/google/workspace/tasks`.

Pedidos sem perfil configurado recebem um erro explícito e não podem aceder ao grant de outro perfil.

## Interface

- O botão `Sync` deixa de simular sucesso.
- Estados visíveis: não ligado, a sincronizar, sincronizado e erro parcial/total.
- Calendar e Tasks apresentam os dados locais mais recentes durante falhas transitórias.
- Após a primeira ligação, os dados Google substituem os exemplos como fonte principal.
- A criação de evento de reunião conserva a estética atual, remove a geração fictícia de Google Meet e aceita localização/link Discord manual.
- A área Discord e as atas não são alteradas nesta fase.

## Erros e segurança

- O servidor não expõe tokens ou segredos em respostas, logs ou código cliente.
- Estados OAuth são aleatórios, expiram e só podem ser usados uma vez.
- Scopes ausentes originam novo consentimento, sem reutilizar silenciosamente um grant incompleto.
- Respostas Google inválidas não substituem o cache local.
- A interface distingue falhas de Calendar e Tasks e permite repetir o sync.
- Esta persistência local serve o localhost; antes de produção, grants devem passar para armazenamento cifrado e autenticação robusta.

## Testes

- OAuth e isolamento de grants entre perfis.
- Validação de scopes e proteção contra reutilização de `state`.
- Criação ou reutilização idempotente da lista `AXION OFFICE`.
- Conversão Google ↔ AXION de eventos e tarefas.
- Paginação, sync incremental e recuperação de HTTP `410`.
- Resolução de conflitos e prevenção de duplicados.
- Criação/edição de eventos e tarefas.
- Conclusão, reabertura e repetição de sync sem duplicar horas de foco.
- Falha parcial sem perda do cache válido.
- Build, TypeScript e regressão dos testes existentes do Drive e perfil.

## Configuração necessária

No projeto Google Cloud atual será necessário ativar Google Calendar API e Google Tasks API, adicionar os scopes ao ecrã de consentimento e voltar a autorizar cada conta. O Drive continua a usar a autorização central existente.

## Referências oficiais

- [Google Calendar API — scopes](https://developers.google.com/workspace/calendar/api/auth)
- [Google Calendar — sincronização incremental](https://developers.google.com/workspace/calendar/api/guides/sync)
- [Google Tasks API](https://developers.google.com/workspace/tasks/reference/rest)
- [Google Keep API](https://developers.google.com/workspace/keep)
