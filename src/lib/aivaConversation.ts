export interface AivaMessage { role: "user" | "assistant"; content: string; }
export interface AivaConversation { id: string; messages: AivaMessage[]; }
export function appendAivaMessage(conversation: AivaConversation, role: AivaMessage["role"], content: string) {
  if (!content.trim()) return;
  const last = conversation.messages.at(-1);
  if (last?.role === role && last.content === content) return;
  conversation.messages.push({ role, content: content.slice(0, 4000) });
  // Bounded shared context across voice, text and both brains.
  if (conversation.messages.length > 40) conversation.messages.splice(0, conversation.messages.length - 40);
  while (conversation.messages.reduce((total, item) => total + item.content.length, 0) > 12000) conversation.messages.shift();
}
