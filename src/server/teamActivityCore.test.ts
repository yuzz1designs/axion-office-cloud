import assert from "node:assert/strict";
import test from "node:test";
import { describeAuditAction } from "./teamActivityCore";
import { listTeamActivity, recordTeamActivity } from "./teamActivityStore";

test("transforma alterações publicadas numa descrição legível", () => {
  assert.equal(describeAuditAction("finance.payment.created", { name: "Supabase" }), "criou o pagamento Supabase");
  assert.equal(describeAuditAction("task.updated", { title: "Enviar proposta", completed: true }), "concluiu a tarefa Enviar proposta");
  assert.equal(describeAuditAction("profile.updated", {}), "atualizou o perfil");
  assert.equal(describeAuditAction("client.updated", { name: "Acme" }), "atualizou o cliente Acme");
  assert.equal(describeAuditAction("team.update.published", { name: "Homepage aprovada" }), "publicou o update Homepage aprovada");
});

test("não expõe nomes vazios nem ações internas desconhecidas", () => {
  assert.equal(describeAuditAction("unknown.internal.event", {}), "publicou uma alteração no AXION OFFICE");
});

test("descreve uploads e alterações específicas sem as esconder como updates genéricos", () => {
  assert.equal(describeAuditAction("document.uploaded", { name: "logo.png" }), "carregou o documento logo.png");
  assert.equal(describeAuditAction("client.logo.updated", { name: "Acme" }), "atualizou o logótipo de Acme");
  assert.equal(describeAuditAction("client.document.uploaded", { name: "Acme", documentName: "contrato.pdf" }), "carregou contrato.pdf na ficha de Acme");
  assert.equal(describeAuditAction("profile.created", {}), "configurou o perfil");
  assert.equal(describeAuditAction("settings.updated", {}), "atualizou as definições pessoais");
  assert.equal(describeAuditAction("google.drive.connected", { name: "nelson@example.com" }), "ligou o Google Drive nelson@example.com");
});

test("a atividade recente inclui ações do próprio utilizador", async () => {
  let excludedActor: string | null = null;
  const auditChain = {
    eq() { return auditChain; },
    neq(_column: string, value: string) { excludedActor = value; return auditChain; },
    order() { return auditChain; },
    async limit() {
      const logs = [{ id: "log-1", actor_user_id: "user-1", action: "document.uploaded", metadata: { name: "logo.png" }, created_at: "2026-09-05T10:00:00Z" }];
      return { data: logs.filter((log) => log.actor_user_id !== excludedActor), error: null };
    },
  };
  const client = {
    from(table: string) {
      if (table === "workspace_members") return { select: () => ({ eq: () => ({ eq: () => ({ single: async () => ({ data: { workspace_id: "workspace-1" }, error: null }) }) }) }) };
      if (table === "audit_logs") return { select: () => auditChain };
      return { select: () => ({ eq: async () => ({ data: [{ user_id: "user-1", preferred_name: "Nelson", display_name: null, email: "nelson@example.com" }], error: null }) }) };
    },
  };

  const activity = await listTeamActivity(client as never, "user-1");
  assert.equal(activity.length, 1);
  assert.equal(activity[0].actorName, "Nelson");
});

test("repete a escrita do audit antes de declarar falha", async () => {
  let attempts = 0;
  const client = {
    from(table: string) {
      if (table === "workspace_members") return { select: () => ({ eq: () => ({ eq: () => ({ single: async () => ({ data: { workspace_id: "workspace-1" }, error: null }) }) }) }) };
      return { insert: async () => ({ error: ++attempts < 3 ? { message: "temporarily unavailable" } : null }) };
    },
  };

  await recordTeamActivity(client as never, "user-1", "document.uploaded", "document", "doc-1", { name: "logo.png" });
  assert.equal(attempts, 3);
});
