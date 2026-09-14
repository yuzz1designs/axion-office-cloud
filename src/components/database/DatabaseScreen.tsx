/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Database, 
  Search, 
  RefreshCw, 
  Download, 
  Plus, 
  Filter, 
  FileSpreadsheet, 
  ArrowUpDown, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ExternalLink,
  ChevronRight,
  SlidersHorizontal,
  TableProperties,
  ArrowLeft,
  X,
  Sparkles,
  Layers,
  Building,
  Tag,
  Columns3,
  Check
} from "lucide-react";
import { AccentColorOption } from "../../types/settings";
import {
  CRM_COLUMNS,
  DEFAULT_VISIBLE_CRM_COLUMNS,
  type CrmColumnKey,
  type CrmCompany,
} from "../../server/crmCompany";

interface DatabaseScreenProps {
  accentColor?: AccentColorOption;
  onBackToOverview?: () => void;
}

interface DataRecord {
  id: string;
  code: string;
  name: string;
  category: string;
  location: string;
  owner: string;
  status: string;
  cost: string;
  lastSync: string;
  crm?: CrmCompany;
}

const LEGACY_RECORDS: DataRecord[] = [
  {
    id: "rec-001",
    code: "EQ-8902",
    name: "Servidor Principal Axion Core Vault 01",
    category: "Infraestruturas",
    location: "Piso -1 • Datacenter Vault",
    owner: "Nelson Afonso",
    status: "Ativo",
    cost: "€ 48.500,00",
    lastSync: "Hoje, 17:45"
  },
  {
    id: "rec-002",
    code: "CL-2204",
    name: "Sistema Chiller HVAC Inverter Central",
    category: "Equipamentos",
    location: "Cobertura • Bloco Técnico A",
    owner: "Carlos Mendes (Facilities)",
    status: "Ativo",
    cost: "€ 32.200,00",
    lastSync: "Hoje, 17:40"
  },
  {
    id: "rec-003",
    code: "BC-1099",
    name: "Rede de Beacons Ultrabroadband (32 nós)",
    category: "Infraestruturas",
    location: "Pisos 1, 2, 3 • Zonas A e B",
    owner: "Nelson Afonso",
    status: "Ativo",
    cost: "€ 14.800,00",
    lastSync: "Hoje, 16:15"
  },
  {
    id: "rec-004",
    code: "MN-4491",
    name: "Calibração de Sensores de CO2 e VOC",
    category: "Manutenção",
    location: "Sala de Reunião VIP • Piso 3",
    owner: "Equipa IoT",
    status: "Pendente",
    cost: "€ 1.450,00",
    lastSync: "Hoje, 14:02"
  },
  {
    id: "rec-005",
    code: "SW-7712",
    name: "Licenciamento Anual FIDO2 Passkey Enterprise",
    category: "Licenças & Software",
    location: "Cloud Enterprise",
    owner: "Segurança de Sistemas",
    status: "Ativo",
    cost: "€ 9.800,00",
    lastSync: "Ontem, 19:30"
  },
  {
    id: "rec-006",
    code: "FN-3021",
    name: "Contrato de Fornecimento de Energia 100% Verde",
    category: "Fornecedores",
    location: "Edifício AXION HQ",
    owner: "Direção de Operações",
    status: "Ativo",
    cost: "€ 78.000,00 / ano",
    lastSync: "28 Ago, 11:20"
  },
  {
    id: "rec-007",
    code: "EQ-4410",
    name: "Painéis de Controlo Tátil Crestron 10″",
    category: "Equipamentos",
    location: "Salas de Conferência A e B",
    owner: "Suporte AV",
    status: "Revisão Necessária",
    cost: "€ 8.600,00",
    lastSync: "27 Ago, 15:00"
  },
  {
    id: "rec-008",
    code: "MN-4498",
    name: "Manutenção Preventiva de UPS e Gerador",
    category: "Manutenção",
    location: "Subsolo • Sala Elétrica",
    owner: "Eng.ª Eletrotécnica",
    status: "Ativo",
    cost: "€ 5.200,00",
    lastSync: "25 Ago, 09:15"
  }
];

const toDataRecord = (company: CrmCompany): DataRecord => ({
  id: company.id,
  code: company.id,
  name: company.company,
  category: company.sector || "Sem setor",
  location: [company.city, company.country].filter(Boolean).join(" • ") || "Sem localização",
  owner: company.owner || "Sem responsável",
  status: company.leadStatus || "Sem estado",
  cost: company.estimatedMonthlyValue || "—",
  lastSync: company.lastContact || "Sem contacto",
  crm: company,
});

const VISIBLE_COLUMNS_STORAGE_KEY = "axion_crm_visible_columns";

export default function DatabaseScreen({
  accentColor = {
    id: "axion-blue",
    name: "AXION Blue",
    hex: "#00f0ff",
    secondary: "#0284c7",
    glow: "rgba(0, 240, 255, 0.4)"
  },
  onBackToOverview
}: DatabaseScreenProps) {
  const [records, setRecords] = useState<DataRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todas as Categorias");
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState("Agora mesmo");
  const [selectedRecord, setSelectedRecord] = useState<DataRecord | null>(null);
  const [isNewRecordModalOpen, setIsNewRecordModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CrmCompany | null>(null);
  const [syncError, setSyncError] = useState("");
  const [isColumnPickerOpen, setIsColumnPickerOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<CrmColumnKey[]>(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(VISIBLE_COLUMNS_STORAGE_KEY) || "null") as unknown;
      if (Array.isArray(stored)) {
        const valid = stored.filter((key): key is CrmColumnKey => CRM_COLUMNS.some((column) => column.key === key));
        if (valid.length) return valid;
      }
    } catch {
      // Use the curated default when storage is unavailable or invalid.
    }
    return DEFAULT_VISIBLE_CRM_COLUMNS;
  });

  // New Record Form State
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<DataRecord["category"]>("Serviços locais");
  const [newLocation, setNewLocation] = useState("");
  const [newOwner, setNewOwner] = useState("Nelson Afonso");
  const [newCost, setNewCost] = useState("");

  const ownerOptions = useMemo(() => Array.from(new Set<string>(
    records.map((record) => record.crm?.owner.trim() || "").filter(Boolean),
  )).sort((a, b) => a.localeCompare(b, "pt")), [records]);

  const toggleColumn = (key: CrmColumnKey) => {
    setVisibleColumns((current) => {
      if (key === "company") return current;
      const next = current.includes(key) ? current.filter((column) => column !== key) : [...current, key];
      window.localStorage.setItem(VISIBLE_COLUMNS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const handleSync = useCallback(async () => {
    setIsSyncing(true);
    setSyncError("");
    try {
      const response = await fetch("/api/crm/companies");
      const result = await response.json() as { companies?: CrmCompany[]; error?: string };
      if (!response.ok || !result.companies) throw new Error(result.error || "Falha na sincronização");
      setRecords(result.companies.map(toDataRecord));
      setLastSyncTime(new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }));
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "Não foi possível sincronizar o CRM.");
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => { void handleSync(); }, [handleSync]);

  const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const company: CrmCompany = {
      id: newCode,
      company: newName.trim(),
      website: "",
      sector: newCategory,
      country: "Portugal",
      city: newLocation.trim(),
      source: "Dashboard AXION",
      idealFit: "3",
      priority: "Média",
      owner: newOwner || "Nelson",
      leadStatus: "Em pesquisa",
      createdAt: new Date().toLocaleDateString("pt-PT"),
      lastContact: "",
      nextAction: "",
      serviceInterest: "Website",
      estimatedMonthlyValue: newCost,
      notes: "Criado através da dashboard AXION",
    };
    setIsSyncing(true);
    setSyncError("");
    try {
      const response = await fetch("/api/crm/companies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(company) });
      const result = await response.json() as { company?: CrmCompany; error?: string; detail?: string };
      if (!response.ok || !result.company) throw new Error(result.detail || result.error || "Não foi possível gravar no Google Sheets.");
      setRecords((current) => [...current.filter((record) => record.id !== result.company!.id), toDataRecord(result.company!)]);
      setIsNewRecordModalOpen(false);
      setNewCode(""); setNewName(""); setNewLocation(""); setNewCost("");
      await handleSync();
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "Não foi possível gravar no Google Sheets.");
    } finally {
      setIsSyncing(false);
    }
  };

  const categories = useMemo(() => ["Todas as Categorias", ...Array.from(new Set(records.map((record) => record.category))).sort()], [records]);

  const handleSaveCompany = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingCompany?.company.trim()) return;
    setIsSyncing(true);
    setSyncError("");
    try {
      const response = await fetch(`/api/crm/companies/${encodeURIComponent(editingCompany.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingCompany),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível atualizar o Google Sheets.");
      setEditingCompany(null);
      setSelectedRecord(null);
      await handleSync();
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "Não foi possível atualizar o Google Sheets.");
    } finally {
      setIsSyncing(false);
    }
  };

  const filteredRecords = useMemo(() => {
    return records.filter((rec) => {
      const matchesSearch = 
        rec.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rec.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rec.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rec.owner.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = 
        selectedCategory === "Todas as Categorias" || rec.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [records, searchQuery, selectedCategory]);

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col py-6 pb-28 relative z-10 select-none">
      
      {/* ================= TOP EDITORIAL HEADER ================= */}
      <div className="flex flex-col gap-6 pb-6 border-b border-white/10">
        
        {/* Top toolbar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBackToOverview && (
              <button
                type="button"
                onClick={onBackToOverview}
                className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-2 text-xs font-sans"
              >
                <ArrowLeft size={16} />
                <span className="hidden sm:inline">Voltar ao Painel</span>
              </button>
            )}
            <span className="text-[11px] font-mono tracking-widest text-white/40 uppercase">
              AXION // LIVE DATABASE & EXCEL DATA HUB
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsColumnPickerOpen((open) => !open)}
                className="px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-white/80 hover:text-white text-xs font-sans border border-white/10 transition-all cursor-pointer flex items-center gap-2"
              >
                <Columns3 size={13} />
                <span>Colunas ({visibleColumns.length}/17)</span>
              </button>
              {isColumnPickerOpen && (
                <div className="absolute right-0 top-full mt-2 z-40 w-72 max-h-[420px] overflow-y-auto rounded-2xl border border-white/15 bg-[#0c1017]/95 p-2 shadow-2xl backdrop-blur-xl">
                  {CRM_COLUMNS.map((column) => {
                    const selected = visibleColumns.includes(column.key);
                    return (
                      <button
                        key={column.key}
                        type="button"
                        disabled={column.key === "company"}
                        onClick={() => toggleColumn(column.key)}
                        className="w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-xs text-white/70 hover:bg-white/[0.06] hover:text-white disabled:cursor-default"
                      >
                        <span>{column.label}</span>
                        <span className={`grid h-4 w-4 place-items-center rounded border ${selected ? "border-[var(--axion-accent)] bg-[var(--axion-accent)] text-slate-950" : "border-white/20"}`}>
                          {selected && <Check size={11} />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            {selectedRecord?.crm && (
              <button
                type="button"
                onClick={() => selectedRecord.crm && setEditingCompany({ ...selectedRecord.crm })}
                className="px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-white/80 hover:text-white text-xs font-sans border border-white/10 transition-all cursor-pointer flex items-center gap-2"
              >
                <SlidersHorizontal size={13} />
                <span>Editar empresa</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleSync}
              disabled={isSyncing}
              className="px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-white/80 hover:text-white text-xs font-sans border border-white/10 transition-all cursor-pointer flex items-center gap-2"
            >
              <RefreshCw size={13} className={isSyncing ? "animate-spin text-[var(--axion-accent)]" : "text-white/60"} />
              <span>{isSyncing ? "A sincronizar..." : "Sincronizar CRM"}</span>
            </button>

            <button
              type="button"
              onClick={() => { setSyncError(""); setIsNewRecordModalOpen(true); }}
              style={{
                backgroundColor: accentColor.hex,
                color: "#050609",
                boxShadow: `0 0 20px ${accentColor.glow}`
              }}
              className="px-4 py-2 rounded-xl font-bold text-xs font-sans transition-all cursor-pointer hover:brightness-110 flex items-center gap-2"
            >
              <Plus size={15} />
              <span>Novo Registo</span>
            </button>
          </div>
        </div>

        {/* Title, Excel Connector info & metrics */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pt-2">
          
          <motion.div 
            initial={{ opacity: 0, x: -28 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col gap-1.5"
          >
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-sans font-bold text-white tracking-tight uppercase">
                BASE DE DADOS, <span className="text-white/70 font-normal">GOOGLE SHEETS CRM</span>
              </h1>
              
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {syncError ? "LIGAÇÃO INTERROMPIDA" : "SINCRONIZAÇÃO ATIVA"}
              </span>

              <span className="text-[10px] font-mono text-white/40 border border-white/10 px-2 py-0.5 rounded-full">
                GOOGLE SHEETS API // BIDIRECIONAL
              </span>
            </div>

            <p className="text-xs md:text-sm text-white/70 font-sans flex items-center gap-2 flex-wrap">
              <FileSpreadsheet size={14} className="text-emerald-400 shrink-0" />
              <span className="font-mono text-white/90">CRM — Empresas</span>
              <span className="text-white/30">•</span>
              <span className="text-white/50">Última sincronização: {lastSyncTime}</span>
              <span className="text-white/30">•</span>
              <span className="text-white/50">{records.length} registos ativos</span>
            </p>
          </motion.div>

          {/* Quick Stats */}
          <div className="flex items-center gap-6 shrink-0 border-l border-white/10 pl-6 hidden lg:flex">
            <div className="flex flex-col">
              <span className="text-[10px] font-mono text-white/40 uppercase">Total Registos</span>
              <span className="text-xl font-bold text-white font-sans">{records.length}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-mono text-white/40 uppercase">Integridade</span>
              <span className="text-xl font-bold text-emerald-400 font-sans">100%</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-mono text-white/40 uppercase">Latência Sync</span>
              <span className="text-xl font-bold text-white/80 font-mono">180ms</span>
            </div>
          </div>

        </div>

      </div>

      {/* ================= SEARCH & CATEGORIES TOOLBAR ================= */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 py-4 border-b border-white/10">
        
        {/* Search input */}
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            placeholder="Pesquisar por código, designação, local ou responsável..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/[0.03] border border-white/10 text-white text-xs font-sans placeholder:text-white/30 focus:outline-none focus:border-[var(--axion-accent)] transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Category selector */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {categories.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-sans whitespace-nowrap transition-all cursor-pointer ${
                  isSelected
                    ? "bg-white/15 text-white font-semibold border border-white/20"
                    : "text-white/50 hover:text-white hover:bg-white/[0.03]"
                }`}
                style={{
                  color: isSelected ? "#ffffff" : undefined
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>

      </div>

      {/* ================= DATA GRID (CLEAN SPREADSHEET VIEW) ================= */}
      <div className="flex flex-col pt-2">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-[10px] font-mono text-white/40 uppercase tracking-wider">
                {CRM_COLUMNS.filter((column) => visibleColumns.includes(column.key)).map((column) => (
                  <th key={column.key} className="py-3 px-3 font-semibold whitespace-nowrap">{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-sans text-xs">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length} className="py-12 text-center text-white/40 text-xs">
                    Nenhum registo encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => {
                  const isSelected = selectedRecord?.id === rec.id;
                  return (
                    <tr
                      key={rec.id}
                      onClick={() => setSelectedRecord(rec)}
                      className={`hover:bg-white/[0.03] transition-colors cursor-pointer group ${
                        isSelected ? "bg-white/[0.05]" : ""
                      }`}
                    >
                      {CRM_COLUMNS.filter((column) => visibleColumns.includes(column.key)).map((column) => {
                        const value = rec.crm?.[column.key] || "—";
                        return (
                          <td
                            key={column.key}
                            className={`py-3 px-3 max-w-[260px] truncate whitespace-nowrap text-[11px] ${
                              column.key === "company" ? "font-medium text-white group-hover:text-[var(--axion-accent)]" :
                              column.key === "id" ? "font-mono font-semibold" : "text-white/65"
                            }`}
                            style={column.key === "id" ? { color: accentColor.hex } : undefined}
                            title={value}
                          >
                            {column.key === "website" && value !== "—" ? (
                              <a href={value} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className="text-[var(--axion-accent)] hover:underline">{value}</a>
                            ) : value}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info strip */}
        <div className="flex items-center justify-between pt-4 border-t border-white/10 text-xs text-white/40">
          <div className="flex items-center gap-2">
            <span>{syncError || `A mostrar ${filteredRecords.length} de ${records.length} empresas da folha CRM`}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono text-white/30">FONTE: GOOGLE SHEETS API</span>
          </div>
        </div>
      </div>

      {/* ================= EDIT COMPANY — WRITES BACK TO GOOGLE SHEETS ================= */}
      <AnimatePresence>
        {editingCompany && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-[#0c1017] border border-white/15 rounded-3xl p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <span className="text-[10px] font-mono tracking-widest text-[var(--axion-accent)] uppercase">Google Sheets // {editingCompany.id}</span>
                  <h3 className="mt-1 text-base font-bold text-white uppercase">Editar empresa no CRM</h3>
                </div>
                <button type="button" onClick={() => setEditingCompany(null)} className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10"><X size={17} /></button>
              </div>

              <form onSubmit={handleSaveCompany} className="mt-5 flex flex-col gap-5 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {([
                    ["company", "Empresa"], ["website", "Website"], ["sector", "Setor"],
                    ["country", "País"], ["city", "Cidade"], ["source", "Origem"],
                    ["idealFit", "Adequação (1-5)"], ["priority", "Prioridade"], ["owner", "Responsável"],
                    ["leadStatus", "Estado do Lead"], ["createdAt", "Data Criada"], ["lastContact", "Último Contacto"],
                    ["nextAction", "Próxima Ação"], ["serviceInterest", "Serviço de Interesse"],
                    ["estimatedMonthlyValue", "Valor Mensal Estimado (€)"],
                  ] as Array<[keyof CrmCompany, string]>).map(([field, label]) => (
                    <label key={field} className="flex flex-col gap-1.5 text-white/65">
                      <span>{label}</span>
                      <input
                        value={editingCompany[field]}
                        list={field === "owner" ? "crm-owner-options" : undefined}
                        required={field === "company"}
                        onChange={(event) => setEditingCompany((current) => current ? { ...current, [field]: event.target.value } : current)}
                        className="px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white outline-none focus:border-[var(--axion-accent)]"
                      />
                    </label>
                  ))}
                  <label className="flex flex-col gap-1.5 text-white/65 sm:col-span-2 lg:col-span-3">
                    <span>Notas</span>
                    <textarea rows={3} value={editingCompany.notes} onChange={(event) => setEditingCompany((current) => current ? { ...current, notes: event.target.value } : current)} className="px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white outline-none resize-none focus:border-[var(--axion-accent)]" />
                  </label>
                </div>
                <div className="flex justify-end gap-3 border-t border-white/10 pt-4">
                  <button type="button" onClick={() => setEditingCompany(null)} className="px-4 py-2.5 rounded-xl text-white/60 hover:text-white">Cancelar</button>
                  <button type="submit" disabled={isSyncing} className="px-5 py-2.5 rounded-xl bg-[var(--axion-accent)] text-slate-950 font-bold hover:brightness-110 disabled:opacity-40">
                    {isSyncing ? "A sincronizar..." : "Guardar no Google Sheets"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= NEW RECORD MODAL ================= */}
      <AnimatePresence>
        {isNewRecordModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-[#0c1017] border border-white/15 rounded-3xl p-6 shadow-2xl flex flex-col gap-5"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-2.5">
                  <TableProperties size={18} style={{ color: accentColor.hex }} />
                  <h3 className="text-base font-bold text-white font-sans tracking-tight uppercase">
                    NOVA EMPRESA, <span className="text-white/70 font-normal">CRM GOOGLE SHEETS</span>
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNewRecordModalOpen(false)}
                  className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/5"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleAddRecord} className="flex flex-col gap-4 text-xs font-sans">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-white/80 font-medium">ID da Empresa</label>
                    <input
                      type="text"
                      placeholder="Automático (CP-021)"
                      value={newCode}
                      onChange={(e) => setNewCode(e.target.value)}
                      className="px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-white font-mono focus:outline-none focus:border-[var(--axion-accent)]"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-white/80 font-medium">Setor</label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as any)}
                      className="px-3 py-2 rounded-xl bg-[#121824] border border-white/10 text-white focus:outline-none focus:border-[var(--axion-accent)]"
                    >
                      <option value="Serviços locais">Serviços locais</option>
                      <option value="Imobiliário">Imobiliário</option>
                      <option value="Restaurantes">Restaurantes</option>
                      <option value="Moda/Beleza">Moda/Beleza</option>
                      <option value="Saúde">Saúde</option>
                      <option value="Tecnologia">Tecnologia</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-white/80 font-medium">Responsável</label>
                  <input
                    type="text"
                    list="crm-owner-options"
                    placeholder="Selecionar ou escrever responsável"
                    value={newOwner}
                    onChange={(event) => setNewOwner(event.target.value)}
                    className="px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-white focus:outline-none focus:border-[var(--axion-accent)]"
                  />
                </div>

                {syncError && (
                  <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2.5 text-red-200">
                    <AlertCircle size={15} className="mt-0.5 shrink-0" />
                    <span>{syncError}</span>
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <label className="text-white/80 font-medium">Nome da Empresa *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Empresa Exemplo Lda."
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-white focus:outline-none focus:border-[var(--axion-accent)]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-white/80 font-medium">Cidade</label>
                    <input
                      type="text"
                      placeholder="Ex: Lisboa"
                      value={newLocation}
                      onChange={(e) => setNewLocation(e.target.value)}
                      className="px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-white focus:outline-none focus:border-[var(--axion-accent)]"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-white/80 font-medium">Valor Mensal Estimado (€)</label>
                    <input
                      type="text"
                      placeholder="Ex: 2.450,00"
                      value={newCost}
                      onChange={(e) => setNewCost(e.target.value)}
                      className="px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-white font-mono focus:outline-none focus:border-[var(--axion-accent)]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setIsNewRecordModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-white/60 hover:text-white text-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSyncing}
                    style={{
                      backgroundColor: accentColor.hex,
                      color: "#050609"
                    }}
                    className="px-5 py-2 rounded-xl font-bold text-xs hover:brightness-110 transition-all cursor-pointer disabled:cursor-wait disabled:opacity-50"
                  >
                    {isSyncing ? "A gravar..." : "Gravar e Sincronizar"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <datalist id="crm-owner-options">
        {ownerOptions.map((owner) => <option key={owner} value={owner} />)}
      </datalist>

    </div>
  );
}
