import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle, ArrowLeft, CalendarClock, Check, CheckCircle2, Clock3, CreditCard,
  Edit3, ExternalLink, History, LoaderCircle, Plus, ReceiptText, RefreshCw, Search,
  Trash2, TrendingUp, WalletCards, X,
  Banknote, CircleDollarSign,
} from "lucide-react";
import type { AccentColorOption } from "../../types/settings";
import {
  FINANCE_CATEGORIES, type BillingType, type FinancePayload, type FinancePayment,
  type FinancePaymentInput, type FinancePaymentStatus,
  type RevenueEntry, type RevenueEntryInput,
} from "../../types/finance";

interface PaymentsScreenProps {
  accentColor?: AccentColorOption;
  onBackToOverview?: () => void;
  isLight?: boolean;
}

type FinanceTab = "summary" | "recurring" | "one_time" | "receivables" | "history";
type StatusFilter = "all" | FinancePaymentStatus | "overdue";

const EMPTY_SUMMARY = { monthlyRevenue: 0, expectedThisMonth: 0, paidThisMonth: 0, outstandingThisMonth: 0, monthlyRecurringCost: 0, annualEquivalent: 0, upcomingCount: 0, overdueCount: 0 };
const EMPTY_PAYLOAD: FinancePayload = { payments: [], transactions: [], projects: [], members: [], clients: [], revenues: [], summary: EMPTY_SUMMARY };
const today = () => new Date().toISOString().slice(0, 10);
const monthAhead = () => { const date = new Date(); date.setDate(date.getDate() + 7); return date.toISOString().slice(0, 10); };
const emptyForm = (): FinancePaymentInput => ({
  name: "", provider: "", category: "Software", amount: 0, currency: "EUR",
  billingType: "monthly_fixed", chargeDay: new Date().getDate(), chargeDate: null,
  nextChargeDate: monthAhead(), paymentMethod: "", status: "active", autoRenew: true,
  responsibleUserId: null, projectId: null, notes: "", websiteUrl: "",
});
const emptyRevenueForm = (): RevenueEntryInput => ({ payerName: "", description: "", amount: 0, currency: "EUR", dueDate: monthAhead(), status: "pending", projectId: null, clientId: null, notes: "" });

const billingLabels: Record<BillingType, string> = { monthly_fixed: "Mensal fixa", annual: "Anual", monthly_variable: "Mensal variável", one_time: "Pagamento único" };
const statusLabels: Record<FinancePaymentStatus, string> = { active: "Ativo", paused: "Pausado", completed: "Concluído", cancelled: "Cancelado" };
const formatMoney = (value: number, currency = "EUR") => new Intl.NumberFormat("pt-PT", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
const formatDate = (value?: string | null) => value ? new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value.slice(0, 10)}T12:00:00`)) : "—";

export default function PaymentsScreen({
  accentColor = { id: "axion-blue", name: "AXION Blue", hex: "#00f0ff", secondary: "#0284c7", glow: "rgba(0, 240, 255, 0.4)" },
  onBackToOverview, isLight = false,
}: PaymentsScreenProps) {
  const [data, setData] = useState<FinancePayload>(EMPTY_PAYLOAD);
  const [activeTab, setActiveTab] = useState<FinanceTab>("summary");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FinancePayment | null>(null);
  const [form, setForm] = useState<FinancePaymentInput>(emptyForm);
  const [paying, setPaying] = useState<FinancePayment | null>(null);
  const [actualAmount, setActualAmount] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [revenueFormOpen, setRevenueFormOpen] = useState(false);
  const [editingRevenue, setEditingRevenue] = useState<RevenueEntry | null>(null);
  const [revenueForm, setRevenueForm] = useState<RevenueEntryInput>(emptyRevenueForm);
  const [receiving, setReceiving] = useState<RevenueEntry | null>(null);
  const [receivedAmount, setReceivedAmount] = useState("");

  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 3200); };
  const request = async (path: string, options?: RequestInit) => {
    const response = await fetch(path, { ...options, headers: options?.body ? { "Content-Type": "application/json", ...options.headers } : options?.headers });
    if (!response.headers.get("content-type")?.includes("application/json")) {
      throw new Error("O Financeiro não está disponível neste site: a API do AXION OFFICE não está ligada à publicação.");
    }
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Não foi possível atualizar o Financeiro.");
    setData(result);
    return result as FinancePayload;
  };
  const load = async () => {
    setLoading(true); setError("");
    try { await request("/api/finance"); }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar o Financeiro."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const visiblePayments = useMemo(() => data.payments.filter((payment) => {
    const recurring = payment.billingType !== "one_time";
    if (activeTab === "recurring" && !recurring) return false;
    if (activeTab === "one_time" && recurring) return false;
    if (categoryFilter !== "all" && payment.category !== categoryFilter) return false;
    const overdue = payment.status === "active" && payment.nextChargeDate < today();
    if (statusFilter === "overdue" && !overdue) return false;
    if (statusFilter !== "all" && statusFilter !== "overdue" && payment.status !== statusFilter) return false;
    const query = search.trim().toLowerCase();
    return !query || [payment.name, payment.provider, payment.responsibleName, payment.projectName].some((value) => value?.toLowerCase().includes(query));
  }), [activeTab, categoryFilter, data.payments, search, statusFilter]);
  const upcoming = useMemo(() => data.payments.filter((payment) => payment.status === "active").sort((a, b) => a.nextChargeDate.localeCompare(b.nextChargeDate)).slice(0, 8), [data.payments]);

  const openCreate = (billingType: BillingType = "monthly_fixed") => { setEditing(null); setForm({ ...emptyForm(), billingType, autoRenew: billingType !== "one_time" }); setFormOpen(true); };
  const openEdit = (payment: FinancePayment) => {
    setEditing(payment);
    setForm({ name: payment.name, provider: payment.provider, category: payment.category, amount: payment.amount, currency: payment.currency, billingType: payment.billingType, chargeDay: payment.chargeDay, chargeDate: payment.chargeDate, nextChargeDate: payment.nextChargeDate, paymentMethod: payment.paymentMethod, status: payment.status, autoRenew: payment.autoRenew, responsibleUserId: payment.responsibleUserId, projectId: payment.projectId, notes: payment.notes, websiteUrl: payment.websiteUrl });
    setFormOpen(true);
  };
  const savePayment = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      await request(editing ? `/api/finance/payments/${editing.id}` : "/api/finance/payments", { method: editing ? "PATCH" : "POST", body: JSON.stringify({ ...form, amount: Number(form.amount), chargeDay: form.billingType.startsWith("monthly") ? Number(form.chargeDay || 1) : null, chargeDate: ["annual", "one_time"].includes(form.billingType) ? form.nextChargeDate : null, autoRenew: form.billingType === "one_time" ? false : form.autoRenew }) });
      setFormOpen(false); notify(editing ? "Pagamento atualizado." : "Pagamento registado.");
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Não foi possível guardar."); }
    finally { setSaving(false); }
  };
  const deletePayment = async (payment: FinancePayment) => {
    if (!window.confirm(`Eliminar “${payment.name}”? O histórico já realizado será preservado.`)) return;
    try { await request(`/api/finance/payments/${payment.id}`, { method: "DELETE" }); notify("Pagamento eliminado; histórico preservado."); }
    catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : "Não foi possível eliminar."); }
  };
  const openPay = (payment: FinancePayment) => { setPaying(payment); setActualAmount(String(payment.amount)); setPaymentNotes(""); };
  const markPaid = async (event: React.FormEvent) => {
    event.preventDefault(); if (!paying) return; setSaving(true); setError("");
    try { await request(`/api/finance/payments/${paying.id}/mark-paid`, { method: "POST", body: JSON.stringify({ expectedDate: paying.nextChargeDate, actualAmount: Number(actualAmount), notes: paymentNotes }) }); setPaying(null); notify("Pagamento confirmado e histórico atualizado."); }
    catch (payError) { setError(payError instanceof Error ? payError.message : "Não foi possível confirmar o pagamento."); }
    finally { setSaving(false); }
  };
  const openRevenueCreate = () => { setEditingRevenue(null); setRevenueForm(emptyRevenueForm()); setRevenueFormOpen(true); };
  const openRevenueEdit = (entry: RevenueEntry) => { setEditingRevenue(entry); setRevenueForm({ payerName: entry.payerName, description: entry.description, amount: entry.amount, currency: entry.currency, dueDate: entry.dueDate, status: entry.status, projectId: entry.projectId, clientId: entry.clientId, notes: entry.notes }); setRevenueFormOpen(true); };
  const saveRevenue = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError("");
    try { await request(editingRevenue ? `/api/finance/revenue/${editingRevenue.id}` : "/api/finance/revenue", { method: editingRevenue ? "PATCH" : "POST", body: JSON.stringify(revenueForm) }); setRevenueFormOpen(false); notify(editingRevenue ? "Vencimento atualizado." : "Vencimento registado."); }
    catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Não foi possível guardar o vencimento."); }
    finally { setSaving(false); }
  };
  const deleteRevenue = async (entry: RevenueEntry) => {
    if (!window.confirm(`Eliminar o vencimento “${entry.description}”?`)) return;
    try { await request(`/api/finance/revenue/${entry.id}`, { method: "DELETE" }); notify("Vencimento eliminado."); }
    catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : "Não foi possível eliminar o vencimento."); }
  };
  const openReceive = (entry: RevenueEntry) => { setReceiving(entry); setReceivedAmount(String(entry.amount)); };
  const markReceived = async (event: React.FormEvent) => {
    event.preventDefault(); if (!receiving) return; setSaving(true); setError("");
    try { await request(`/api/finance/revenue/${receiving.id}/mark-received`, { method: "POST", body: JSON.stringify({ actualAmount: Number(receivedAmount), receivedAt: new Date().toISOString() }) }); setReceiving(null); notify("Recebimento confirmado e revenue atualizado."); }
    catch (receiveError) { setError(receiveError instanceof Error ? receiveError.message : "Não foi possível confirmar o recebimento."); }
    finally { setSaving(false); }
  };

  const panel = isLight ? "bg-white/80 border-slate-200" : "bg-white/[0.025] border-white/[0.08]";
  const primaryText = isLight ? "text-slate-900" : "text-white";
  const mutedText = isLight ? "text-slate-500" : "text-white/45";
  const metricCards = [
    { label: "Revenue do mês", value: data.summary.monthlyRevenue, icon: CircleDollarSign, color: "#34d399" },
    { label: "Previsto este mês", value: data.summary.expectedThisMonth, icon: CalendarClock },
    { label: "Já pago", value: data.summary.paidThisMonth, icon: CheckCircle2, color: "#34d399" },
    { label: "Por pagar", value: data.summary.outstandingThisMonth, icon: Clock3, color: "#fbbf24" },
    { label: "Recorrente mensal", value: data.summary.monthlyRecurringCost, icon: RefreshCw },
    { label: "Equivalente anual", value: data.summary.annualEquivalent, icon: TrendingUp },
    { label: "Em atraso", value: data.summary.overdueCount, icon: AlertTriangle, count: true, color: "#fb7185" },
  ];

  return <div className={`w-full max-w-[1580px] mx-auto flex flex-col gap-6 px-2 sm:px-4 pb-14 ${primaryText}`}>
    <AnimatePresence>{toast && <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="fixed right-6 top-6 z-[70] flex items-center gap-3 rounded-xl border border-emerald-400/30 bg-[#0d1518]/95 px-4 py-3 text-xs text-white shadow-2xl backdrop-blur-xl"><CheckCircle2 size={16} className="text-emerald-400" />{toast}</motion.div>}</AnimatePresence>

    <header className="flex flex-col gap-4 pt-1 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3">{onBackToOverview && <button onClick={onBackToOverview} className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${panel}`}><ArrowLeft size={14} /></button>}<div><span className="font-mono text-[9px] uppercase tracking-[0.24em]" style={{ color: accentColor.hex }}>AXION CONTROL LAYER</span><h1 className="text-xl font-bold uppercase tracking-tight md:text-2xl">Financeiro</h1><p className={`mt-0.5 text-xs ${mutedText}`}>Despesas, vencimentos e revenue da operação.</p></div></div>
      <div className="flex items-center gap-2"><button onClick={() => void load()} disabled={loading} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs transition-colors ${panel}`}><RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Atualizar</button><button onClick={() => activeTab === "receivables" ? openRevenueCreate() : openCreate(activeTab === "one_time" ? "one_time" : "monthly_fixed")} className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-black shadow-lg transition-transform active:scale-95" style={{ background: accentColor.hex, boxShadow: `0 0 18px ${accentColor.glow}` }}><Plus size={14} /> {activeTab === "receivables" ? "Novo vencimento" : "Novo pagamento"}</button></div>
    </header>

    <nav className={`flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border p-1 ${panel}`}>{([["summary", "Resumo"], ["recurring", "Pagamentos recorrentes"], ["one_time", "Despesas pontuais"], ["receivables", "Vencimentos"], ["history", "Histórico"]] as const).map(([id, label]) => <button key={id} onClick={() => setActiveTab(id)} className={`whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs transition-all ${activeTab === id ? "bg-white/10 font-semibold" : mutedText}`}>{label}</button>)}</nav>
    {error && <div className="flex items-center justify-between rounded-xl border border-rose-400/25 bg-rose-400/[0.07] px-4 py-3 text-xs text-rose-200"><span className="flex items-center gap-2"><AlertTriangle size={14} />{error}</span><button onClick={() => setError("")}><X size={14} /></button></div>}

    {loading ? <div className={`flex min-h-72 items-center justify-center rounded-2xl border ${panel}`}><LoaderCircle size={24} className="animate-spin" style={{ color: accentColor.hex }} /></div>
    : activeTab === "summary" ? <div className="flex flex-col gap-5">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">{metricCards.map(({ label, value, icon: Icon, color, count }) => <article key={label} className={`min-h-28 rounded-2xl border p-4 ${panel}`}><div className="flex items-center justify-between"><span className={`font-mono text-[9px] uppercase tracking-wider ${mutedText}`}>{label}</span><Icon size={14} style={{ color: color || accentColor.hex }} /></div><strong className="mt-4 block font-mono text-xl tracking-tight" style={{ color }}>{count ? value : formatMoney(value)}</strong></article>)}</section>
      <section className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
        <div className={`rounded-2xl border ${panel}`}><div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4"><div><h2 className="text-sm font-semibold">Próximos pagamentos</h2><p className={`mt-1 text-[10px] ${mutedText}`}>Ordenados pela próxima cobrança prevista.</p></div><CalendarClock size={16} style={{ color: accentColor.hex }} /></div><div className="divide-y divide-white/[0.06]">{upcoming.length ? upcoming.map((payment) => { const overdue = payment.nextChargeDate < today(); return <div key={payment.id} className="flex items-center justify-between gap-4 px-5 py-3.5"><div className="flex min-w-0 items-center gap-3"><div className={`flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl border ${overdue ? "border-rose-400/25 bg-rose-400/10 text-rose-300" : panel}`}><span className="font-mono text-[8px] uppercase">{new Date(`${payment.nextChargeDate}T12:00:00`).toLocaleDateString("pt-PT", { month: "short" })}</span><b className="font-mono text-sm">{payment.nextChargeDate.slice(8)}</b></div><div className="min-w-0"><p className="truncate text-xs font-semibold">{payment.name}</p><p className={`truncate text-[10px] ${mutedText}`}>{payment.provider} · {payment.category}</p></div></div><div className="flex items-center gap-3"><strong className="font-mono text-xs">{formatMoney(payment.amount, payment.currency)}</strong><button onClick={() => openPay(payment)} className="rounded-lg px-2.5 py-1.5 text-[10px] font-bold text-black" style={{ background: accentColor.hex }}>Pagar</button></div></div>; }) : <p className={`px-5 py-12 text-center text-xs ${mutedText}`}>Ainda não existem pagamentos registados.</p>}</div></div>
        <aside className={`rounded-2xl border p-5 ${panel}`}><WalletCards size={18} style={{ color: accentColor.hex }} /><h2 className="mt-4 text-sm font-semibold">Leitura operacional</h2><p className={`mt-2 text-xs leading-relaxed ${mutedText}`}>O custo base recorrente representa {formatMoney(data.summary.monthlyRecurringCost)} por mês. Existem {data.summary.upcomingCount} pagamentos futuros e {data.summary.overdueCount} em atraso.</p><div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: `${Math.min(100, data.summary.expectedThisMonth ? (data.summary.paidThisMonth / data.summary.expectedThisMonth) * 100 : 0)}%`, background: accentColor.hex }} /></div><p className={`mt-2 font-mono text-[9px] uppercase ${mutedText}`}>Progresso mensal pago</p></aside>
      </section>
    </div>
    : activeTab === "receivables" ? <RevenueTable entries={data.revenues} panel={panel} mutedText={mutedText} accent={accentColor.hex} onReceive={openReceive} onEdit={openRevenueEdit} onDelete={deleteRevenue} />
    : activeTab === "history" ? <section className={`overflow-hidden rounded-2xl border ${panel}`}><div className="flex items-center gap-2 border-b border-white/[0.07] px-5 py-4"><History size={15} style={{ color: accentColor.hex }} /><h2 className="text-sm font-semibold">Histórico de pagamentos realizados</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className={`font-mono text-[9px] uppercase tracking-wider ${mutedText}`}><tr><th className="px-5 py-3">Pagamento</th><th className="px-4 py-3">Data prevista</th><th className="px-4 py-3">Pago em</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3 text-right">Valor real</th><th className="px-5 py-3">Documento</th></tr></thead><tbody className="divide-y divide-white/[0.05]">{data.transactions.length ? data.transactions.map((transaction) => <tr key={transaction.id} className="hover:bg-white/[0.02]"><td className="px-5 py-3.5"><b>{transaction.paymentName}</b>{transaction.notes && <p className={`mt-1 max-w-xs truncate text-[10px] ${mutedText}`}>{transaction.notes}</p>}</td><td className="px-4 py-3.5 font-mono">{formatDate(transaction.expectedDate)}</td><td className="px-4 py-3.5 font-mono">{formatDate(transaction.paidAt)}</td><td className="px-4 py-3.5"><span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 text-[9px] uppercase text-emerald-300"><Check size={9} />Pago</span></td><td className="px-4 py-3.5 text-right font-mono font-bold">{formatMoney(Number(transaction.actualAmount || 0), transaction.currency)}</td><td className={`px-5 py-3.5 text-[10px] ${mutedText}`}><span className="flex items-center gap-1.5"><ReceiptText size={12} />Preparado</span></td></tr>) : <tr><td colSpan={6} className={`px-5 py-14 text-center ${mutedText}`}>O histórico será criado quando marcares um pagamento como pago.</td></tr>}</tbody></table></div></section>
    : <PaymentsTable payments={visiblePayments} panel={panel} mutedText={mutedText} accent={accentColor.hex} categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter} statusFilter={statusFilter} setStatusFilter={setStatusFilter} search={search} setSearch={setSearch} onPay={openPay} onEdit={openEdit} onDelete={deletePayment} />}

    <AnimatePresence>{formOpen && <Modal onClose={() => !saving && setFormOpen(false)}><form onSubmit={savePayment} className="flex max-h-[88vh] flex-col"><ModalHeader title={editing ? "Editar pagamento" : "Novo pagamento"} onClose={() => setFormOpen(false)} accent={accentColor.hex} /><div className="grid gap-3 overflow-y-auto px-5 py-4 sm:grid-cols-2">
      <Field label="Nome"><input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field><Field label="Fornecedor"><input required value={form.provider} onChange={(event) => setForm({ ...form, provider: event.target.value })} /></Field>
      <Field label="Categoria"><select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as FinancePaymentInput["category"] })}>{FINANCE_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></Field><Field label="Tipo de cobrança"><select value={form.billingType} onChange={(event) => { const billingType = event.target.value as BillingType; setForm({ ...form, billingType, autoRenew: billingType !== "one_time" && form.autoRenew }); }}>{Object.entries(billingLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
      <Field label="Valor previsto"><input required min="0" step="0.01" type="number" value={form.amount} onChange={(event) => setForm({ ...form, amount: Number(event.target.value) })} /></Field><Field label="Moeda"><select value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })}><option>EUR</option><option>USD</option><option>GBP</option></select></Field>
      <Field label="Próxima cobrança"><input required type="date" value={form.nextChargeDate} onChange={(event) => setForm({ ...form, nextChargeDate: event.target.value })} /></Field>{form.billingType.startsWith("monthly") && <Field label="Dia habitual"><input min="1" max="31" type="number" value={form.chargeDay || ""} onChange={(event) => setForm({ ...form, chargeDay: Number(event.target.value) })} /></Field>}
      <Field label="Método de pagamento"><input value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value })} /></Field><Field label="Estado"><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as FinancePaymentStatus })}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
      <Field label="Responsável"><select value={form.responsibleUserId || ""} onChange={(event) => setForm({ ...form, responsibleUserId: event.target.value || null })}><option value="">Sem responsável</option>{data.members.map((member) => <option key={member.userId} value={member.userId}>{member.name}</option>)}</select></Field><Field label="Projeto associado"><select value={form.projectId || ""} onChange={(event) => setForm({ ...form, projectId: event.target.value || null })}><option value="">Sem projeto</option>{data.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></Field>
      <Field label="Website / URL" wide><input type="url" value={form.websiteUrl || ""} onChange={(event) => setForm({ ...form, websiteUrl: event.target.value })} /></Field><Field label="Notas" wide><textarea rows={3} value={form.notes || ""} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field>
      {form.billingType !== "one_time" && <label className="col-span-full flex items-center gap-2 text-xs text-white/70"><input type="checkbox" checked={form.autoRenew} onChange={(event) => setForm({ ...form, autoRenew: event.target.checked })} /> Renovação automática</label>}
    </div><ModalActions saving={saving} onCancel={() => setFormOpen(false)} label={editing ? "Guardar alterações" : "Criar pagamento"} accent={accentColor.hex} /></form></Modal>}</AnimatePresence>

    <AnimatePresence>{revenueFormOpen && <Modal onClose={() => !saving && setRevenueFormOpen(false)}><form onSubmit={saveRevenue} className="flex max-h-[88vh] flex-col"><ModalHeader title={editingRevenue ? "Editar vencimento" : "Novo vencimento"} onClose={() => setRevenueFormOpen(false)} accent={accentColor.hex} /><div className="grid gap-3 overflow-y-auto px-5 py-4 sm:grid-cols-2">
      <Field label="Cliente / pagador"><input required value={revenueForm.payerName} onChange={(event) => setRevenueForm({ ...revenueForm, payerName: event.target.value })} /></Field><Field label="Descrição"><input required value={revenueForm.description} onChange={(event) => setRevenueForm({ ...revenueForm, description: event.target.value })} /></Field>
      <Field label="Cliente associado" wide><select value={revenueForm.clientId || ""} onChange={(event) => { const clientId = event.target.value || null; const client = data.clients.find((item) => item.id === clientId); setRevenueForm({ ...revenueForm, clientId, payerName: client?.name || revenueForm.payerName }); }}><option value="">Sem cliente associado</option>{data.clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></Field>
      <Field label="Valor previsto"><input required min="0" step="0.01" type="number" value={revenueForm.amount} onChange={(event) => setRevenueForm({ ...revenueForm, amount: Number(event.target.value) })} /></Field><Field label="Moeda"><select value={revenueForm.currency} onChange={(event) => setRevenueForm({ ...revenueForm, currency: event.target.value })}><option>EUR</option><option>USD</option><option>GBP</option></select></Field>
      <Field label="Data de vencimento"><input required type="date" value={revenueForm.dueDate} onChange={(event) => setRevenueForm({ ...revenueForm, dueDate: event.target.value })} /></Field><Field label="Estado"><select value={revenueForm.status} onChange={(event) => setRevenueForm({ ...revenueForm, status: event.target.value as RevenueEntryInput["status"] })}><option value="pending">Pendente</option><option value="cancelled">Cancelado</option>{editingRevenue?.status === "received" && <option value="received">Recebido</option>}</select></Field>
      <Field label="Projeto associado" wide><select value={revenueForm.projectId || ""} onChange={(event) => setRevenueForm({ ...revenueForm, projectId: event.target.value || null })}><option value="">Sem projeto</option>{data.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></Field><Field label="Notas" wide><textarea rows={3} value={revenueForm.notes || ""} onChange={(event) => setRevenueForm({ ...revenueForm, notes: event.target.value })} /></Field>
    </div><ModalActions saving={saving} onCancel={() => setRevenueFormOpen(false)} label={editingRevenue ? "Guardar alterações" : "Criar vencimento"} accent={accentColor.hex} /></form></Modal>}</AnimatePresence>

    <AnimatePresence>{receiving && <Modal onClose={() => !saving && setReceiving(null)}><form onSubmit={markReceived}><ModalHeader title="Marcar como recebido" onClose={() => setReceiving(null)} accent="#34d399" /><div className="space-y-4 px-5 py-5"><div className="rounded-xl border border-white/10 bg-white/[0.03] p-4"><p className="text-sm font-semibold">{receiving.description}</p><p className="mt-1 text-[10px] text-white/40">{receiving.payerName} · vencimento {formatDate(receiving.dueDate)}</p></div><Field label="Valor efetivamente recebido"><input autoFocus required min="0" step="0.01" type="number" value={receivedAmount} onChange={(event) => setReceivedAmount(event.target.value)} /></Field><p className="text-[10px] leading-relaxed text-white/40">Ao confirmar, este valor entra imediatamente no indicador de revenue do mês atual.</p></div><ModalActions saving={saving} onCancel={() => setReceiving(null)} label="Confirmar recebimento" accent="#34d399" /></form></Modal>}</AnimatePresence>

    <AnimatePresence>{paying && <Modal onClose={() => !saving && setPaying(null)}><form onSubmit={markPaid}><ModalHeader title="Marcar como pago" onClose={() => setPaying(null)} accent="#34d399" /><div className="space-y-4 px-5 py-5"><div className="rounded-xl border border-white/10 bg-white/[0.03] p-4"><p className="text-sm font-semibold">{paying.name}</p><p className="mt-1 text-[10px] text-white/40">Previsto para {formatDate(paying.nextChargeDate)} · {formatMoney(paying.amount, paying.currency)}</p></div><Field label={paying.billingType === "monthly_variable" ? "Valor real obrigatório" : "Valor efetivamente pago"}><input autoFocus required min="0" step="0.01" type="number" value={actualAmount} onChange={(event) => setActualAmount(event.target.value)} /></Field><Field label="Notas"><textarea rows={3} value={paymentNotes} onChange={(event) => setPaymentNotes(event.target.value)} placeholder="Referência, ajuste de valor ou observação..." /></Field></div><ModalActions saving={saving} onCancel={() => setPaying(null)} label="Confirmar pagamento" accent="#34d399" /></form></Modal>}</AnimatePresence>
  </div>;
}

interface PaymentsTableProps {
  payments: FinancePayment[]; panel: string; mutedText: string; accent: string;
  categoryFilter: string; setCategoryFilter: (value: string) => void;
  statusFilter: StatusFilter; setStatusFilter: (value: StatusFilter) => void;
  search: string; setSearch: (value: string) => void;
  onPay: (payment: FinancePayment) => void; onEdit: (payment: FinancePayment) => void; onDelete: (payment: FinancePayment) => void;
}

function RevenueTable({ entries, panel, mutedText, accent, onReceive, onEdit, onDelete }: {
  entries: RevenueEntry[];
  panel: string;
  mutedText: string;
  accent: string;
  onReceive: (entry: RevenueEntry) => void;
  onEdit: (entry: RevenueEntry) => void;
  onDelete: (entry: RevenueEntry) => void;
}) {
  const ordered = [...entries].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return <section className={`overflow-hidden rounded-2xl border ${panel}`}>
    <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4"><div><h2 className="text-sm font-semibold">Vencimentos</h2><p className={`mt-1 text-[10px] ${mutedText}`}>Pagamentos que clientes e parceiros têm de fazer à AXION.</p></div><Banknote size={17} style={{ color: accent }} /></div>
    <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs"><thead className={`font-mono text-[9px] uppercase tracking-wider ${mutedText}`}><tr><th className="px-5 py-3">Cliente / pagador</th><th className="px-4 py-3">Descrição</th><th className="px-4 py-3">Vencimento</th><th className="px-4 py-3">Projeto</th><th className="px-4 py-3 text-right">Valor</th><th className="px-4 py-3">Estado</th><th className="px-5 py-3 text-right">Ações</th></tr></thead><tbody className="divide-y divide-white/[0.05]">{ordered.length ? ordered.map((entry) => {
      const overdue = entry.status === "pending" && entry.dueDate < today();
      const status = entry.status === "received" ? "Recebido" : entry.status === "cancelled" ? "Cancelado" : overdue ? "Em atraso" : "Pendente";
      return <tr key={entry.id} className="hover:bg-white/[0.025]"><td className="px-5 py-3.5 font-semibold">{entry.payerName || "Sem pagador"}</td><td className="px-4 py-3.5"><span>{entry.description}</span>{entry.notes && <p className={`mt-1 max-w-xs truncate text-[10px] ${mutedText}`}>{entry.notes}</p>}</td><td className={`px-4 py-3.5 font-mono ${overdue ? "text-rose-300" : ""}`}>{formatDate(entry.dueDate)}</td><td className={`px-4 py-3.5 ${mutedText}`}>{entry.projectName || "—"}</td><td className="px-4 py-3.5 text-right font-mono font-bold">{formatMoney(entry.status === "received" ? Number(entry.actualAmount ?? entry.amount) : entry.amount, entry.currency)}</td><td className="px-4 py-3.5"><span className={`rounded-full border px-2 py-0.5 text-[9px] uppercase ${entry.status === "received" ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300" : overdue ? "border-rose-400/25 bg-rose-400/10 text-rose-300" : "border-white/15 bg-white/5 text-white/50"}`}>{status}</span>{entry.receivedDate && <p className={`mt-1 text-[9px] ${mutedText}`}>{formatDate(entry.receivedDate)}</p>}</td><td className="px-5 py-3.5"><div className="flex justify-end gap-1"><button disabled={entry.status !== "pending"} onClick={() => onReceive(entry)} className="rounded-lg px-2.5 py-1.5 text-[10px] font-bold text-black disabled:cursor-not-allowed disabled:opacity-30" style={{ background: accent }}>Marcar recebido</button><button onClick={() => onEdit(entry)} className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white"><Edit3 size={13} /></button><button onClick={() => onDelete(entry)} className="rounded-lg p-1.5 text-white/40 hover:bg-rose-400/10 hover:text-rose-300"><Trash2 size={13} /></button></div></td></tr>;
    }) : <tr><td colSpan={7} className={`px-5 py-14 text-center ${mutedText}`}>Ainda não existem vencimentos registados.</td></tr>}</tbody></table></div>
  </section>;
}

function PaymentsTable({ payments, panel, mutedText, accent, categoryFilter, setCategoryFilter, statusFilter, setStatusFilter, search, setSearch, onPay, onEdit, onDelete }: PaymentsTableProps) {
  return <section className="flex flex-col gap-3"><div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between"><div className="flex flex-1 flex-wrap items-center gap-2"><div className="relative min-w-52 max-w-sm flex-1"><Search size={13} className={`absolute left-3 top-1/2 -translate-y-1/2 ${mutedText}`} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar pagamento..." className={`w-full rounded-xl border bg-transparent py-2 pl-8 pr-3 text-xs outline-none ${panel}`} /></div><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className={`rounded-xl border px-3 py-2 text-xs outline-none ${panel}`}><option value="all">Todas as categorias</option>{FINANCE_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} className={`rounded-xl border px-3 py-2 text-xs outline-none ${panel}`}><option value="all">Todos os estados</option><option value="active">Ativos</option><option value="overdue">Em atraso</option><option value="paused">Pausados</option><option value="completed">Concluídos</option><option value="cancelled">Cancelados</option></select></div></div>
    <div className={`overflow-hidden rounded-2xl border ${panel}`}><div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-xs"><thead className={`font-mono text-[9px] uppercase tracking-wider ${mutedText}`}><tr><th className="px-5 py-3">Pagamento</th><th className="px-4 py-3">Categoria</th><th className="px-4 py-3">Cobrança</th><th className="px-4 py-3">Próxima</th><th className="px-4 py-3">Responsável / Projeto</th><th className="px-4 py-3 text-right">Valor</th><th className="px-4 py-3">Estado</th><th className="px-5 py-3 text-right">Ações</th></tr></thead><tbody className="divide-y divide-white/[0.05]">{payments.length ? payments.map((payment) => { const overdue = payment.status === "active" && payment.nextChargeDate < today(); return <tr key={payment.id} className="group hover:bg-white/[0.025]"><td className="px-5 py-3.5"><div className="flex items-center gap-2"><div><b>{payment.name}</b><p className={`mt-0.5 text-[10px] ${mutedText}`}>{payment.provider}</p></div>{payment.websiteUrl && <a href={payment.websiteUrl} target="_blank" rel="noreferrer" className={mutedText}><ExternalLink size={11} /></a>}</div></td><td className="px-4 py-3.5"><span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px]">{payment.category}</span></td><td className="px-4 py-3.5">{billingLabels[payment.billingType]}{payment.autoRenew && <p className={`mt-1 text-[9px] ${mutedText}`}>Renovação automática</p>}</td><td className={`px-4 py-3.5 font-mono ${overdue ? "text-rose-300" : ""}`}>{formatDate(payment.nextChargeDate)}</td><td className="px-4 py-3.5"><span>{payment.responsibleName || "Sem responsável"}</span>{payment.projectName && <p className={`mt-1 text-[10px] ${mutedText}`}>{payment.projectName}</p>}</td><td className="px-4 py-3.5 text-right font-mono font-bold">{formatMoney(payment.amount, payment.currency)}</td><td className="px-4 py-3.5"><span className={`rounded-full border px-2 py-0.5 text-[9px] uppercase ${overdue ? "border-rose-400/25 bg-rose-400/10 text-rose-300" : payment.status === "active" ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300" : "border-white/15 bg-white/5 text-white/50"}`}>{overdue ? "Em atraso" : statusLabels[payment.status]}</span></td><td className="px-5 py-3.5"><div className="flex justify-end gap-1"><button disabled={payment.status !== "active"} onClick={() => onPay(payment)} className="rounded-lg px-2.5 py-1.5 text-[10px] font-bold text-black disabled:cursor-not-allowed disabled:opacity-30" style={{ background: accent }}>Marcar pago</button><button onClick={() => onEdit(payment)} className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white"><Edit3 size={13} /></button><button onClick={() => onDelete(payment)} className="rounded-lg p-1.5 text-white/40 hover:bg-rose-400/10 hover:text-rose-300"><Trash2 size={13} /></button></div></td></tr>; }) : <tr><td colSpan={8} className={`px-5 py-14 text-center ${mutedText}`}>Nenhum pagamento corresponde aos filtros selecionados.</td></tr>}</tbody></table></div></div>
  </section>;
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) { return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => event.target === event.currentTarget && onClose()} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"><motion.div initial={{ opacity: 0, scale: 0.97, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/15 bg-[#0c111b] text-white shadow-2xl">{children}</motion.div></motion.div>; }
function ModalHeader({ title, onClose, accent }: { title: string; onClose: () => void; accent: string }) { return <div className="flex items-center justify-between border-b border-white/10 px-5 py-4"><div className="flex items-center gap-2"><CreditCard size={16} style={{ color: accent }} /><h3 className="text-sm font-semibold">{title}</h3></div><button type="button" onClick={onClose} className="text-white/40 hover:text-white"><X size={16} /></button></div>; }
function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: React.ReactElement }) { return <label className={`flex flex-col gap-1.5 ${wide ? "sm:col-span-2" : ""}`}><span className="font-mono text-[9px] uppercase tracking-wider text-white/45">{label}</span>{React.cloneElement(children as React.ReactElement<{ className?: string }>, { className: "rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white outline-none transition-colors focus:border-white/30" })}</label>; }
function ModalActions({ saving, onCancel, label, accent }: { saving: boolean; onCancel: () => void; label: string; accent: string }) { return <div className="flex justify-end gap-2 border-t border-white/10 px-5 py-4"><button type="button" onClick={onCancel} disabled={saving} className="rounded-xl bg-white/5 px-4 py-2 text-xs text-white/60">Cancelar</button><button disabled={saving} className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-black disabled:opacity-50" style={{ background: accent }}>{saving && <LoaderCircle size={13} className="animate-spin" />}{label}</button></div>; }
