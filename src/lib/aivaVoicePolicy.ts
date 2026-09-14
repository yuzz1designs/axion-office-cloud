export const AIVA_SPEECH_RULES = "Responde sempre em português europeu de Portugal (pt-PT). Mantém a mesma voz, pronúncia e cadência entre respostas. Nomes de aplicações, resultados web ou mensagens de ferramentas em inglês não são pedidos para mudar de idioma. Traduz explicações de erros para português. Só muda de língua se o utilizador o pedir explicitamente. Sê breve; não leias URLs, código ou nomes internos de ferramentas em voz alta.";
export function realtimeReply(instructions: string, purpose: "answer" | "done" | "greeting" = "answer") {
  const task = purpose === "done" ? "A ação terminou com sucesso. Responde apenas: Feito." : purpose === "greeting" ? "Responde apenas: Olá, estou a ouvir." : "Responde ao pedido atual usando os resultados das ferramentas, quando existirem.";
  return { type: "response.create", response: { instructions: `${instructions}\n${AIVA_SPEECH_RULES}\n${task}` } };
}
export const RECOVERABLE_REALTIME_ERRORS = new Set(["response_cancel_not_active", "conversation_already_has_active_response", "response_already_in_progress", "input_audio_buffer_commit_empty"]);
