import { createHash, randomBytes } from "node:crypto";
const approvals = new Map<string, { userId: string; digest: string; until: number }>();
const digest = (name: string, args: unknown) => createHash("sha256").update(JSON.stringify({ name, args })).digest("hex");
export function issueComputerApproval(userId: string, name: string, args: unknown) {
  for (const [token, approval] of approvals) if (approval.until < Date.now()) approvals.delete(token);
  const token = randomBytes(24).toString("hex");
  approvals.set(token, { userId, digest: digest(name, args), until: Date.now() + 60000 });
  return token;
}
export function consumeComputerApproval(token: string, userId: string, name: string, args: unknown) {
  const approval = approvals.get(token); approvals.delete(token);
  return !!approval && approval.userId === userId && approval.until > Date.now() && approval.digest === digest(name, args);
}
