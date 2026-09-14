# AXION Desktop Companion — versão local macOS

Requer macOS, Node 22 e as dependências do AXION OFFICE instaladas. O controlo visual requer macOS 14+ e Command Line Tools (clang).

No diretório do projeto:

```sh
npm run companion
```

Em localhost:3000, inicia sessão na conta AXION, abre AIVA → macOS e introduz o código de associação apresentado pelo Companion. O código expira em dez minutos e só pode ser usado uma vez. A associação cria um dispositivo em `user_devices` no Supabase, pertencente ao utilizador autenticado.

Por defeito, ficam disponíveis ficheiros dentro da pasta pessoal, sempre sujeitos às permissões do macOS. Para restringir o acesso, passa uma ou mais **pastas específicas existentes**:

```sh
npm run companion -- "/caminho/para/documentos-autorizados"
```

`npm run companion -- --no-files` desativa ferramentas de ficheiros. O Companion não permite escapar das pastas autorizadas por `..` ou symlinks, substituir ficheiros nem executar shell. Leitura e criação ficam limitadas a texto/Markdown/CSV/JSON; cópia/movimentação aceitam ficheiros regulares. A organização por tipo ou mês permite pré-visualizar, não percorre subpastas e ignora conflitos sem substituir originais.

Para controlo visual, depois de associar, abre **AIVA → macOS → Ativar controlo do computador**. Autoriza AXIONControl (ou o processo responsável indicado pelo macOS) em **Privacidade e Segurança → Acessibilidade / Gravação do ecrã**. Só são anunciadas capacidades efetivamente autorizadas. Cada clique, escrita e tecla pede confirmação; é exigida uma captura recente antes de cada interação. O helper volta a focar a aplicação observada antes de agir. Não controla terminais por teclado. As capturas necessárias ao pedido são enviadas ao modelo; não há captura contínua em segundo plano.

No seletor de permissões, adiciona `companion/bin/AXIONControl.app`, não o executável sem extensão. O build cria e assina localmente esse bundle. Mantém `npm run dev` e `npm run companion` em terminais separados: o dashboard precisa de ambos para associar o Mac.

## Ligação e permissões

- O processo escuta apenas em `127.0.0.1:4319`. O browser comunica com o backend AXION autenticado; não chama o macOS diretamente.
- Código aleatório de 128 bits, cinco tentativas no máximo; token de ligação de 256 bits, guardado apenas na memória do backend e Companion.
- Cada pedido verifica utilizador, token, allowlist e revogação no Supabase. O endpoint de associação AXION aceita apenas o localhost do próprio Mac.
- A UI verifica ligação a cada 30 segundos e recupera de falhas transitórias. Reiniciar o backend ou Companion exige reiniciar o Companion e voltar a associar. Não há credenciais persistidas em texto simples.
- Revogar na AIVA invalida o token e marca o dispositivo como revogado no Supabase.
- O macOS pode recusar clipboard, documentos ou notificações; a AIVA comunica a falha. Uma notificação aceite pelo sistema não garante que seja mostrada se o utilizador a bloquear.

## Capacidades reais desta versão

Sistema/hora, bateria, estado básico da rede, volume/mute, clipboard a pedido, notificações, abertura de aplicações instaladas, sites e pesquisas Google no browser, Finder, listagem/criação de pastas, organização/cópia/movimentação de ficheiros e repouso. Com permissões nativas: captura do ecrã principal, cliques, escrita, teclas e scroll. No Hands Free, operações visuais são encaminhadas para o cérebro ativo; a voz comunica o resultado. Volume é lido após a alteração para confirmar o resultado. A rede informa interfaces ativas; não afirma ter Internet apenas com base nisso.

Brilho, bloqueio de ecrã, reinício e shutdown não são anunciados. Precisam de uma implementação nativa apropriada e, nas ações destrutivas, confirmação. Distribuição assinada/notarizada, arranque automático e ligação a um servidor AXION remoto ficam para a versão distribuída; este processo é explicitamente para localhost.

O modelo Mark II e a ligação ao Mac são estados independentes. Não é preciso ligar o Companion para usar Astra em perguntas e ferramentas AXION/web.
