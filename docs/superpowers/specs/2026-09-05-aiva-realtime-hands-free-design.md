# AIVA Realtime Hands-Free — Design

## Objetivo

Adicionar à AIVA um modo de conversa por voz contínuo, natural e de baixa latência. O utilizador ativa o modo uma vez, conversa sem voltar a tocar no microfone, pode interromper uma resposta falando por cima da AIVA e encerra a sessão explicitamente ou ao sair do módulo.

O modo manual existente mantém-se como fallback. Não serão integrados Chatterbox, motores locais ou fornecedores de voz adicionais nesta fase.

## Decisões

- Usar OpenAI Realtime por WebRTC, a interface recomendada para voz no browser.
- Usar a interface WebRTC unificada: o servidor AXION envia o SDP e a configuração da sessão à OpenAI com a API key protegida.
- Modelo predefinido: `gpt-realtime-2.1`.
- Voz predefinida: `cedar`.
- Disponibilizar as vozes Realtime suportadas: `alloy`, `ash`, `ballad`, `coral`, `echo`, `sage`, `shimmer`, `verse`, `marin` e `cedar`.
- Usar deteção semântica de fim de turno para evitar a espera fixa de três segundos e reduzir interrupções indevidas.
- A alteração de voz encerra e recria a sessão, pois a voz não pode mudar depois de a sessão começar a emitir áudio.

## Backend

O middleware da AIVA recebe um novo endpoint `POST /api/aiva/realtime/session` com `Content-Type: application/sdp`.

O endpoint:

1. valida autenticação e limita o tamanho do SDP;
2. cria a configuração Realtime com a identidade existente da AIVA, o modelo e a voz escolhida;
3. configura áudio de entrada com turn detection semântico, criação automática de resposta e interrupção automática da resposta;
4. inclui transcrição de entrada para atualizar o texto visível na interface;
5. envia SDP e configuração para `https://api.openai.com/v1/realtime/calls` usando `OPENAI_API_KEY` apenas no servidor;
6. devolve ao browser o SDP de resposta sem expor segredos.

Vozes recebidas do cliente são validadas contra uma allowlist. Erros da OpenAI são normalizados e não incluem credenciais ou payloads sensíveis.

## Cliente

Um hook isolado, `useAivaRealtimeVoice`, gere:

- `RTCPeerConnection`;
- stream do microfone e respetivas tracks;
- elemento de áudio remoto com autoplay;
- data channel de eventos Realtime;
- estados `off`, `connecting`, `listening`, `thinking`, `speaking` e `error`;
- transcrições do utilizador e da AIVA;
- interrupção por voz enquanto a AIVA fala;
- encerramento idempotente de peer connection, data channel, áudio e microfone.

O hook não substitui o fluxo manual existente. Cada modo tem recursos próprios e a ativação de um encerra o outro para impedir gravações ou respostas concorrentes.

## Interface

A barra da AIVA recebe:

- controlo visível `Hands Free` com estado ativo/inativo;
- seletor de voz nas definições da AIVA;
- indicação persistente quando o microfone está ativo;
- estados legíveis: a ligar, a ouvir, a processar, a falar e falha de ligação;
- ação clara para desligar a sessão.

Ao ativar Hands Free, a sessão permanece ativa até o utilizador desligar, iniciar o modo manual, criar uma nova sessão ou sair da AIVA. Uma falha não remove o modo manual nem deixa o microfone ativo.

## Desempenho

O novo fluxo elimina as três chamadas sequenciais atuais — upload para transcrição, geração textual e síntese TTS. O áudio entra e sai pela mesma ligação WebRTC e a resposta é reproduzida em streaming. A interface não espera pelo áudio completo para começar a reproduzir.

## Segurança e privacidade

- A API key permanece exclusivamente no servidor.
- O endpoint Realtime exige uma sessão AXION válida.
- A sessão usa um identificador de segurança estável e não identificável derivado do utilizador autenticado.
- O microfone é encerrado ao desligar, desmontar o componente, perder a ligação ou ocorrer erro.
- A UI informa claramente que a voz é sintética e quando o microfone está ativo.

## Falhas e fallback

- Falha de permissão: mensagem específica e recursos libertados.
- Falha de negociação SDP/OpenAI: sessão encerrada e modo manual preservado.
- Queda da ligação: estado de erro, cleanup completo e possibilidade de tentar novamente.
- Evento inválido no data channel: ignorado sem terminar áudio válido.
- Mudança de voz: encerramento limpo seguido de nova ligação apenas se Hands Free continuar ativo.

## Testes

- validação de voz e construção segura da configuração Realtime;
- tratamento de respostas e erros do endpoint SDP;
- redutor dos eventos Realtime e transcrições;
- transições de estado do Hands Free;
- interrupção e cancelamento de pedidos antigos;
- cleanup idempotente de peer connection, tracks, data channel e áudio;
- manutenção do modo manual quando Realtime falha;
- typecheck, lint, testes completos e build.

## Fora de âmbito

- Chatterbox ou outros motores TTS;
- clonagem de voz;
- gravação ou armazenamento de áudio;
- sessões de voz em segundo plano fora do módulo AIVA;
- ferramentas empresariais executadas pela AIVA.
