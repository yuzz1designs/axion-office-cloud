/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Users, 
  Search, 
  Plus, 
  Building2, 
  Briefcase, 
  Mail, 
  Phone, 
  Globe, 
  MapPin, 
  Calendar, 
  Clock, 
  FileText, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  DollarSign, 
  CreditCard, 
  ArrowLeft, 
  ExternalLink, 
  ChevronRight, 
  Filter, 
  Download, 
  Edit3, 
  UserCheck, 
  Layers, 
  MessageSquare, 
  TrendingUp, 
  Sparkles,
  X,
  Building,
  Zap,
  Check,
  FileCheck,
  BarChart3,
  Target,
  MousePointerClick,
  Workflow,
  LineChart,
  Save,
  Trash2,
  KeyRound,
  ImageUp,
  UploadCloud,
  LoaderCircle
} from "lucide-react";
import { AccentColorOption } from "../../types/settings";
import { CURRENT_USER } from "../../data/currentUser";
import { sumMonthlyClientValue, type ClientDocumentReference } from "../../server/clientCore";

interface ClientsScreenProps {
  accentColor?: AccentColorOption;
  onBackToOverview?: () => void;
  requestedClient?: string;
  onRequestedClientHandled?: () => void;
}

export interface ClientContact {
  name: string;
  role: string;
  email: string;
  phone: string;
  isPrimary?: boolean;
}

export interface ClientInvoice {
  id: string;
  number: string;
  date: string;
  amount: string;
  status: "Pago" | "Pendente" | "Processamento";
}

export interface ClientRecord {
  id: string;
  reference: string;
  name: string;
  legalName: string;
  vatNumber: string;
  segment: "Enterprise" | "Scaleup" | "E-Commerce" | "B2B Corporativo" | "Institucional";
  status: "Ativo" | "Em Onboarding" | "Em Otimização" | "Renovação";
  industry: string;
  website: string;
  generalEmail: string;
  generalPhone: string;
  headquarters: string;
  clientSince: string;
  accountManager: string;
  mrrValue: string;
  arrValue: string;
  adSpendManaged: string;
  contractType: string;
  contractRenewal: string;
  paymentTerms: string;
  monthlyLeads: number;
  monthlyOrganicTraffic: string;
  averageRoas: string;
  conversionRate: string;
  executiveSummary: string;
  brandColor: string;
  brandGradient: string;
  logoCode: string;
  logoUrl?: string;
  contacts: ClientContact[];
  invoices: ClientInvoice[];
  notes: Array<{ id: string; date: string; author: string; text: string }>;
  associatedDocs: ClientDocumentReference[];
}

const SEGMENTS = [
  "Todos os Segmentos",
  "Enterprise",
  "Scaleup",
  "E-Commerce",
  "B2B Corporativo",
  "Institucional"
];

// Corporate real vector brand logos
function CompanyBrandLogo({ client, size = "md" }: { client: ClientRecord; size?: "sm" | "md" | "lg" | "xl" }) {
  const dims = 
    size === "xl" ? "w-20 h-20 rounded-2xl p-2.5" :
    size === "lg" ? "w-14 h-14 rounded-xl p-2" :
    size === "md" ? "w-11 h-11 rounded-xl p-1.5" : 
    "w-8 h-8 rounded-lg p-1";

  const renderRealisticBrandLogo = () => {
    if (client.logoUrl) return <img src={client.logoUrl} alt={`Logótipo ${client.name}`} className="h-full w-full rounded-[inherit] object-contain" />;
    switch (client.id) {
      case "cli-001":
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full drop-shadow-md" fill="none">
            <defs>
              <linearGradient id="nt-g1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00f0ff" />
                <stop offset="50%" stopColor="#0284c7" />
                <stop offset="100%" stopColor="#3b82f6" />
              </linearGradient>
              <linearGradient id="nt-g2" x1="100%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#0369a1" stopOpacity="0.4" />
              </linearGradient>
            </defs>
            <path d="M32 6L54 18.5V45.5L32 58L10 45.5V18.5L32 6Z" fill="#040e1f" stroke="url(#nt-g1)" strokeWidth="2" />
            <path d="M32 6L54 18.5L32 31L10 18.5L32 6Z" fill="url(#nt-g2)" />
            <path d="M10 18.5L32 31V58L10 45.5V18.5Z" fill="#031633" fillOpacity="0.8" />
            <path d="M54 18.5L32 31V58L54 45.5V18.5Z" fill="#082859" fillOpacity="0.9" />
            <path d="M22 41V23L32 31L42 23V41" stroke="#00f0ff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="32" cy="31" r="3" fill="#ffffff" />
            <circle cx="22" cy="23" r="2" fill="#00f0ff" />
            <circle cx="42" cy="23" r="2" fill="#00f0ff" />
          </svg>
        );

      case "cli-002":
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full drop-shadow-md" fill="none">
            <defs>
              <linearGradient id="lum-g1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="50%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#047857" />
              </linearGradient>
              <linearGradient id="lum-g2" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#fbbf24" />
                <stop offset="100%" stopColor="#f59e0b" />
              </linearGradient>
            </defs>
            <rect x="6" y="6" width="52" height="52" rx="16" fill="#042017" stroke="url(#lum-g1)" strokeWidth="1.5" />
            <path 
              d="M32 14C39.7 14 46 20.3 46 28C46 38 32 48 32 48C32 48 18 38 18 28C18 20.3 24.3 14 32 14Z" 
              fill="url(#lum-g1)" 
              fillOpacity="0.25"
              stroke="url(#lum-g1)"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            <path 
              d="M32 20C36.4 20 40 23.6 40 28C40 34 32 41 32 41C32 41 24 34 24 28C24 23.6 27.6 20 32 20Z" 
              fill="url(#lum-g2)"
              fillOpacity="0.85"
            />
            <circle cx="32" cy="28" r="3.5" fill="#ffffff" />
            <path d="M32 10V13M44 16L42 18M20 16L22 18" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
          </svg>
        );

      case "cli-003":
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full drop-shadow-md" fill="none">
            <defs>
              <linearGradient id="bio-g1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fb7185" />
                <stop offset="50%" stopColor="#f43f5e" />
                <stop offset="100%" stopColor="#e11d48" />
              </linearGradient>
              <linearGradient id="bio-g2" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#c084fc" />
                <stop offset="100%" stopColor="#9333ea" />
              </linearGradient>
            </defs>
            <rect x="6" y="6" width="52" height="52" rx="16" fill="#200615" stroke="url(#bio-g1)" strokeWidth="1.5" />
            <path 
              d="M17 24C23 24 27 40 37 40C43 40 47 36 47 32C47 28 43 24 37 24C27 24 23 40 17 40C11 40 7 36 7 32C7 28 11 24 17 24Z" 
              stroke="url(#bio-g1)" 
              strokeWidth="3.5" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
            />
            <path 
              d="M21 28L25 36M39 28L43 36M30 31L34 33" 
              stroke="url(#bio-g2)" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
            />
            <circle cx="17" cy="24" r="3.5" fill="#fb7185" />
            <circle cx="37" cy="40" r="3.5" fill="#c084fc" />
            <circle cx="32" cy="32" r="2.5" fill="#ffffff" />
          </svg>
        );

      case "cli-004":
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full drop-shadow-md" fill="none">
            <defs>
              <linearGradient id="apx-g1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="40%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#b45309" />
              </linearGradient>
              <linearGradient id="apx-g2" x1="100%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#fbbf24" />
                <stop offset="100%" stopColor="#78350f" />
              </linearGradient>
            </defs>
            <rect x="6" y="6" width="52" height="52" rx="16" fill="#1c1203" stroke="url(#apx-g1)" strokeWidth="1.5" />
            <path d="M32 12L50 48H14L32 12Z" fill="#120b02" />
            <path d="M32 12L42 48H32V12Z" fill="url(#apx-g1)" />
            <path d="M32 12L22 48H32V12Z" fill="url(#apx-g2)" />
            <path d="M32 23L47 48H39L32 34L25 48H17L32 23Z" fill="url(#apx-g1)" />
            <polygon points="32,23 35,34 29,34" fill="#ffffff" />
          </svg>
        );

      case "cli-005":
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full drop-shadow-md" fill="none">
            <defs>
              <linearGradient id="icc-g1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#60a5fa" />
                <stop offset="50%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#1d4ed8" />
              </linearGradient>
              <linearGradient id="icc-g2" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#93c5fd" />
                <stop offset="100%" stopColor="#1e40af" />
              </linearGradient>
            </defs>
            <path 
              d="M32 8L52 16V32C52 44.5 43.5 53.5 32 57C20.5 53.5 12 44.5 12 32V16L32 8Z" 
              fill="#061226" 
              stroke="url(#icc-g1)" 
              strokeWidth="2" 
            />
            <path 
              d="M32 18L44 24V34C44 41 39 46.5 32 49C25 46.5 20 41 20 34V24L32 18Z" 
              fill="url(#icc-g1)" 
              fillOpacity="0.2" 
              stroke="url(#icc-g2)" 
              strokeWidth="1.5" 
            />
            <circle cx="32" cy="30" r="4.5" fill="#60a5fa" />
            <path d="M30 32L28 41H36L34 32" fill="#60a5fa" />
            <circle cx="32" cy="30" r="2" fill="#ffffff" />
          </svg>
        );

      case "cli-006":
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full drop-shadow-md" fill="none">
            <defs>
              <linearGradient id="kry-g1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#e879f9" />
                <stop offset="50%" stopColor="#c084fc" />
                <stop offset="100%" stopColor="#7e22ce" />
              </linearGradient>
            </defs>
            <rect x="6" y="6" width="52" height="52" rx="16" fill="#180424" stroke="url(#kry-g1)" strokeWidth="1.5" />
            <path d="M32 13L50 45H39L32 31L25 45H14L32 13Z" fill="url(#kry-g1)" fillOpacity="0.9" />
            <path d="M32 23L42 45H22L32 23Z" fill="#180424" />
            <circle cx="32" cy="13" r="3" fill="#f472b6" />
            <circle cx="14" cy="45" r="3" fill="#e879f9" />
            <circle cx="50" cy="45" r="3" fill="#e879f9" />
            <circle cx="32" cy="31" r="2.5" fill="#ffffff" />
          </svg>
        );

      default:
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full drop-shadow-md" fill="none">
            <rect x="6" y="6" width="52" height="52" rx="16" fill="#0b1120" stroke={client.brandColor} strokeWidth="1.5" />
            <polygon points="32,12 48,22 48,42 32,52 16,42 16,22" fill={client.brandColor} fillOpacity="0.15" stroke={client.brandColor} strokeWidth="1" />
            <text 
              x="32" 
              y="38" 
              textAnchor="middle" 
              fill="#ffffff" 
              fontSize="20" 
              fontWeight="900" 
              fontFamily="system-ui, -apple-system, sans-serif"
              letterSpacing="1"
            >
              {client.logoCode || client.name.slice(0, 2).toUpperCase()}
            </text>
          </svg>
        );
    }
  };

  return (
    <div className={`${dims} flex items-center justify-center shrink-0 relative transition-transform duration-300 group-hover:scale-105`}>
      {renderRealisticBrandLogo()}
    </div>
  );
}

export default function ClientsScreen({
  accentColor = {
    id: "axion-blue",
    name: "AXION Blue",
    hex: "#00f0ff",
    secondary: "#0284c7",
    glow: "rgba(0, 240, 255, 0.4)"
  },
  onBackToOverview,
  requestedClient = "",
  onRequestedClientHandled,
}: ClientsScreenProps) {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [clientSaving, setClientSaving] = useState(false);
  const [clientError, setClientError] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSegment, setSelectedSegment] = useState("Todos os Segmentos");
  const [activeDetailTab, setActiveDetailTab] = useState<"geral" | "metricas" | "contactos" | "contratos" | "notas">("geral");
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [editingClient, setEditingClient] = useState<ClientRecord | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletePasskey, setDeletePasskey] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [contractUploading, setContractUploading] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch("/api/clients").then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível carregar os clientes.");
      if (active) setClients(result.clients || []);
    }).catch((error) => { if (active) setClientError(error instanceof Error ? error.message : "Não foi possível carregar os clientes."); })
      .finally(() => { if (active) setClientsLoading(false); });
    return () => { active = false; };
  }, []);

  const replaceClient = (updated: ClientRecord) => setClients((current) => current.map((client) => client.id === updated.id ? updated : client));
  const updateClientInDatabase = async (updated: ClientRecord) => {
    const response = await fetch(`/api/clients/${updated.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updated) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Não foi possível guardar o cliente.");
    replaceClient(result.client);
    return result.client as ClientRecord;
  };

  // New Client Form State
  const [newClientName, setNewClientName] = useState("");
  const [newClientVat, setNewClientVat] = useState("");
  const [newClientIndustry, setNewClientIndustry] = useState("");
  const [newClientSegment, setNewClientSegment] = useState<ClientRecord["segment"]>("Enterprise");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientContactName, setNewClientContactName] = useState("");
  const [newClientMrr, setNewClientMrr] = useState("");

  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      const matchesSearch = 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.legalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.vatNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.industry.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.contacts.some(cnt => cnt.name.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesSegment = selectedSegment === "Todos os Segmentos" || c.segment === selectedSegment;

      return matchesSearch && matchesSegment;
    });
  }, [clients, searchQuery, selectedSegment]);

  const selectedClient = useMemo(() => {
    if (!selectedClientId) return null;
    return clients.find(c => c.id === selectedClientId) || null;
  }, [clients, selectedClientId]);

  useEffect(() => {
    const query = requestedClient.trim().toLocaleLowerCase("pt");
    if (!query || !clients.length) return;
    const match = clients.find((client) => [client.name, client.legalName, client.reference].some((value) => value.toLocaleLowerCase("pt").includes(query)));
    if (match) setSelectedClientId(match.id);
    else setSearchQuery(requestedClient);
    onRequestedClientHandled?.();
  }, [clients, onRequestedClientHandled, requestedClient]);

  // Agency Global Metrics
  const totalMRR = useMemo(() => {
    return `${new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(sumMonthlyClientValue(clients))} / mês`;
  }, [clients]);

  const totalARR = useMemo(() => {
    return `${new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(sumMonthlyClientValue(clients) * 12)} / ano`;
  }, [clients]);

  const totalLeadsMonthly = useMemo(() => {
    return clients.reduce((acc, c) => acc + c.monthlyLeads, 0);
  }, [clients]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim() || !selectedClient) return;

    const newNote = {
      id: `nt-${Date.now()}`,
      date: "Hoje, " + new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }),
      author: "Nelson Afonso",
      text: newNoteText.trim()
    };

    try {
      await updateClientInDatabase({ ...selectedClient, notes: [newNote, ...selectedClient.notes] });
      setNewNoteText("");
    } catch (error) { setClientError(error instanceof Error ? error.message : "Não foi possível guardar a nota."); }
  };

  const handleOpenEditor = () => {
    if (!selectedClient) return;
    setEditingClient({
      ...selectedClient,
      contacts: selectedClient.contacts.map((contact) => ({ ...contact })),
    });
  };

  const updateEditingClient = <K extends keyof ClientRecord>(field: K, value: ClientRecord[K]) => {
    setEditingClient((current) => current ? { ...current, [field]: value } : current);
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient?.name.trim()) return;
    setClientSaving(true); setClientError("");
    try {
      await updateClientInDatabase({ ...editingClient, name: editingClient.name.trim(), legalName: editingClient.legalName.trim(), logoCode: editingClient.logoCode.trim() || editingClient.name.slice(0, 2).toUpperCase() });
      setEditingClient(null);
    } catch (error) { setClientError(error instanceof Error ? error.message : "Não foi possível guardar o cliente."); }
    finally { setClientSaving(false); }
  };

  const handleLogoUpload = async (file?: File) => {
    if (!file || !editingClient) return;
    setClientSaving(true); setClientError("");
    try {
      const response = await fetch(`/api/clients/${editingClient.id}/logo`, { method: "POST", headers: { "Content-Type": file.type }, body: file });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível importar o logótipo.");
      setEditingClient(result.client);
      replaceClient(result.client);
    } catch (error) { setClientError(error instanceof Error ? error.message : "Não foi possível importar o logótipo."); }
    finally { setClientSaving(false); }
  };

  const handleContractDocumentUpload = async (files: File[]) => {
    if (!files.length || !selectedClient || contractUploading) return;
    setContractUploading(true); setClientError("");
    let updatedClient = selectedClient;
    try {
      for (const file of files) {
        const response = await fetch(`/api/clients/${updatedClient.id}/documents`, {
          method: "POST",
          headers: { "Content-Type": file.type || "application/octet-stream", "X-File-Name": encodeURIComponent(file.name) },
          body: file,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail || result.error || `Não foi possível carregar ${file.name}.`);
        updatedClient = result.client as ClientRecord;
        replaceClient(updatedClient);
      }
    } catch (error) {
      setClientError(error instanceof Error ? error.message : "Não foi possível carregar o documento.");
    } finally {
      setContractUploading(false);
    }
  };

  const handleConfirmDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!CURRENT_USER.hasAllPermissions || !selectedClient) return;
    if (deletePasskey.trim() !== CURRENT_USER.axPasskey) {
      setDeleteError("AX PASSKEY inválida. Confirma a credencial apresentada no teu perfil.");
      return;
    }

    setClientSaving(true);
    try {
      const response = await fetch(`/api/clients/${selectedClient.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível eliminar o cliente.");
      setClients((current) => current.filter((client) => client.id !== selectedClient.id));
      setSelectedClientId(null); setIsDeleteModalOpen(false); setDeletePasskey(""); setDeleteError("");
    } catch (error) { setDeleteError(error instanceof Error ? error.message : "Não foi possível eliminar o cliente."); }
    finally { setClientSaving(false); }
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim()) return;

    const mrrNum = parseFloat(newClientMrr.replace(/[^0-9.]/g, "")) || 0;
    const arrVal = `€ ${(mrrNum * 12).toLocaleString("pt-PT")},00 / ano`;
    const mrrVal = `€ ${mrrNum.toLocaleString("pt-PT")},00 / mês`;

    const newRec: ClientRecord = {
      id: `cli-${Date.now()}`,
      reference: `CLI-ECO-2026-${String(clients.length + 1).padStart(3, "0")}`,
      name: newClientName.trim(),
      legalName: newClientName.trim(),
      vatNumber: newClientVat.trim(),
      segment: newClientSegment,
      status: "Em Onboarding",
      industry: newClientIndustry.trim(),
      website: "",
      generalEmail: newClientEmail.trim(),
      generalPhone: newClientPhone.trim(),
      headquarters: "",
      clientSince: new Date().toLocaleDateString("pt-PT", { month: "long", year: "numeric" }),
      accountManager: "",
      mrrValue: mrrVal,
      arrValue: arrVal,
      adSpendManaged: "",
      contractType: "",
      contractRenewal: "",
      paymentTerms: "",
      monthlyLeads: 0,
      monthlyOrganicTraffic: "",
      averageRoas: "",
      conversionRate: "",
      executiveSummary: "",
      brandColor: "#00f0ff",
      brandGradient: "from-cyan-500/20 via-blue-600/20 to-slate-900/30",
      logoCode: newClientName.trim().slice(0, 2).toUpperCase(),
      contacts: newClientContactName.trim() || newClientEmail.trim() || newClientPhone.trim() ? [{ name: newClientContactName.trim(), role: "", email: newClientEmail.trim(), phone: newClientPhone.trim(), isPrimary: true }] : [],
      invoices: [],
      notes: [],
      associatedDocs: []
    };

    setClientSaving(true); setClientError("");
    try {
      const response = await fetch("/api/clients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newRec) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível criar o cliente.");
      const created = result.client as ClientRecord;
      setClients((current) => [created, ...current]);
      setSelectedClientId(created.id);
      setIsNewClientModalOpen(false);

      setNewClientName(""); setNewClientVat(""); setNewClientIndustry(""); setNewClientEmail(""); setNewClientPhone(""); setNewClientContactName(""); setNewClientMrr("");
    } catch (error) { setClientError(error instanceof Error ? error.message : "Não foi possível criar o cliente."); }
    finally { setClientSaving(false); }
  };

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col py-6 pb-28 relative z-10 select-none">
      
      {/* ========================================================================= */}
      {/* VIEW A: DIRETÓRIO DE CLIENTES & ECOSSISTEMAS DIGITAIS                     */}
      {/* ========================================================================= */}
      {!selectedClient ? (
        <motion.div
          key="client-directory-view"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
          className="flex flex-col gap-8"
        >
          {/* Header Superior da Agência */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-white/10">
            <motion.div 
              initial={{ opacity: 0, x: -28 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col gap-1.5"
            >
              <div className="flex items-center gap-3">
                {onBackToOverview && (
                  <button
                    type="button"
                    onClick={onBackToOverview}
                    className="p-2 -ml-2 rounded-xl text-white/50 hover:text-white hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-2 text-xs"
                  >
                    <ArrowLeft size={16} />
                    <span className="hidden sm:inline">Painel Geral</span>
                  </button>
                )}
                <span className="text-[11px] font-mono tracking-widest text-[var(--axion-accent)] uppercase flex items-center gap-1.5">
                  <Workflow size={13} />
                  ECOSSISTEMAS DIGITAIS & CLIENTES
                </span>
              </div>

              <h1 className="text-2xl md:text-3xl font-sans font-bold text-white tracking-tight uppercase">
                CLIENTES, <span className="text-white/70 font-normal">ECOSSISTEMAS DIGITAIS</span>
              </h1>
              <p className="text-xs md:text-sm text-white/60 font-sans">
                Gestão centralizada de CRMs, websites, SEO, tráfego pago, redes sociais e performance digital por empresa.
              </p>
            </motion.div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsNewClientModalOpen(true)}
                style={{
                  backgroundColor: accentColor.hex,
                  color: "#050609",
                  boxShadow: `0 0 20px ${accentColor.glow}`
                }}
                className="px-4 py-2.5 rounded-xl font-bold text-xs font-sans transition-all cursor-pointer hover:brightness-110 flex items-center gap-2 shadow-lg"
              >
                <Plus size={16} />
                <span>Novo Ecossistema</span>
              </button>
            </div>
          </div>

          {clientError && <div className="flex items-center gap-2 rounded-xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-xs text-rose-200"><AlertCircle size={14} />{clientError}</div>}

          {/* Barra de Pesquisa e Filtros Rápidos */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                placeholder="Pesquisar por empresa, setor, contacto ou NIF..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-white text-xs font-sans placeholder:text-white/30 focus:outline-none focus:border-[var(--axion-accent)] transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Segment Filter Buttons */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {SEGMENTS.map((seg) => {
                const isSel = selectedSegment === seg;
                return (
                  <button
                    key={seg}
                    type="button"
                    onClick={() => setSelectedSegment(seg)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-sans whitespace-nowrap transition-all cursor-pointer ${
                      isSel 
                        ? "bg-white/15 text-white font-semibold border border-white/20" 
                        : "text-white/40 hover:text-white hover:bg-white/[0.04] border border-transparent"
                    }`}
                  >
                    {seg}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Grelha de Empresas / Ecossistemas Digitais com Logotipos Reais */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {clientsLoading ? (
              <div className="col-span-full flex items-center justify-center py-16"><LoaderCircle size={24} className="animate-spin text-[var(--axion-accent)]" /></div>
            ) : filteredClients.length === 0 ? (
              <div className="col-span-full py-16 text-center text-white/40 text-xs bg-white/[0.01] border border-white/5 rounded-3xl flex flex-col items-center justify-center gap-3">
                <Building2 size={32} className="text-white/20" />
                <span>Nenhum ecossistema encontrado com os termos de pesquisa atuais.</span>
              </div>
            ) : (
              filteredClients.map((client) => {
                return (
                  <div
                    key={client.id}
                    onClick={() => {
                      setSelectedClientId(client.id);
                      setActiveDetailTab("geral");
                    }}
                    className="group p-5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/10 hover:border-white/25 transition-all duration-300 cursor-pointer flex flex-col justify-between gap-5 relative overflow-hidden"
                  >
                    {/* Top Row: Brand Logo + Company Info + Status */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3.5">
                        <CompanyBrandLogo client={client} size="lg" />

                        <div className="flex flex-col gap-0.5">
                          <h2 className="text-base font-bold text-white font-sans tracking-tight group-hover:text-[var(--axion-accent)] transition-colors">
                            {client.name}
                          </h2>
                          <span className="text-xs text-white/50 font-sans">
                            {client.industry}
                          </span>
                          <span className="text-[10px] font-mono text-white/35">
                            NIF: {client.vatNumber}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold border ${
                          client.status === "Ativo"
                            ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"
                            : client.status === "Renovação"
                            ? "text-amber-400 bg-amber-400/10 border-amber-400/20"
                            : "text-cyan-400 bg-cyan-400/10 border-cyan-400/20"
                        }`}>
                          {client.status}
                        </span>

                        <span className="text-[10px] font-mono text-white/40">
                          {client.segment}
                        </span>
                      </div>
                    </div>

                    {/* Marketing & Digital Performance KPIs */}
                    <div className="grid grid-cols-3 gap-2 py-2.5 px-3 rounded-xl bg-white/[0.02] border border-white/5 text-xs">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-mono text-white/40 uppercase flex items-center gap-1">
                          <MousePointerClick size={10} className="text-[var(--axion-accent)]" />
                          Leads / Mês
                        </span>
                        <span className="font-mono font-bold text-white text-xs sm:text-sm">
                          {client.monthlyLeads}
                        </span>
                      </div>

                      <div className="flex flex-col">
                        <span className="text-[9px] font-mono text-white/40 uppercase flex items-center gap-1">
                          <LineChart size={10} className="text-emerald-400" />
                          Tráfego SEO
                        </span>
                        <span className="font-mono font-bold text-emerald-400 text-xs sm:text-sm">
                          {client.monthlyOrganicTraffic}
                        </span>
                      </div>

                      <div className="flex flex-col">
                        <span className="text-[9px] font-mono text-white/40 uppercase flex items-center gap-1">
                          <BarChart3 size={10} className="text-amber-400" />
                          Retainer MRR
                        </span>
                        <span className="font-mono font-bold text-white text-xs sm:text-sm">
                          {client.mrrValue.split("/")[0]}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end pt-2 border-t border-white/5 text-xs text-white/60">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-white/70 group-hover:text-white group-hover:translate-x-1 transition-all">
                        <span>Ver Ecossistema</span>
                        <ChevronRight size={14} style={{ color: accentColor.hex }} />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Resumo Consolidado de Agência Digital */}
          <div className="p-5 rounded-2xl bg-white/[0.01] border border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/50 font-sans">
            <div className="flex items-center gap-6">
              <span><strong>{clients.length}</strong> ecossistemas digitais ativos</span>
              <span className="flex items-center gap-1 text-emerald-400">
                <Target size={13} />
                <strong>{totalLeadsMonthly.toLocaleString("pt-PT")}</strong> leads geradas / mês
              </span>
            </div>
            <div className="font-mono text-white/70">
              MRR Total Sob Gestão: <span className="text-white font-bold">{totalMRR}</span>
            </div>
          </div>
        </motion.div>
      ) : (

        /* ========================================================================= */
        /* VIEW B: FICHA COMPLETA DO ECOSSISTEMA DIGITAL (Ao clicar na empresa)     */
        /* ========================================================================= */
        <motion.div
          key="client-detail-view"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
          className="flex flex-col gap-6"
        >
          {/* Top Bar: Voltar + Exportar */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <button
              type="button"
              onClick={() => setSelectedClientId(null)}
              className="px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-white/80 hover:text-white text-xs font-sans border border-white/10 transition-all cursor-pointer flex items-center gap-2"
            >
              <ArrowLeft size={15} />
              <span>← Voltar à Lista de Clientes</span>
            </button>

            <div className="flex items-center gap-2">
              {CURRENT_USER.hasAllPermissions && (
                <>
                  <button
                    type="button"
                    onClick={handleOpenEditor}
                    className="px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-white/80 hover:text-white text-xs font-sans border border-white/10 transition-all cursor-pointer flex items-center gap-2"
                  >
                    <Edit3 size={14} />
                    <span>Editar Ficha</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeletePasskey("");
                      setDeleteError("");
                      setIsDeleteModalOpen(true);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-red-500/[0.06] hover:bg-red-500/15 text-red-300 hover:text-red-200 text-xs font-sans border border-red-400/20 transition-all cursor-pointer flex items-center gap-2"
                  >
                    <Trash2 size={14} />
                    <span className="hidden sm:inline">Excluir Ecossistema</span>
                  </button>
                </>
              )}
              <a
                href={selectedClient.website}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-white/80 hover:text-white text-xs font-sans border border-white/10 transition-all cursor-pointer flex items-center gap-2"
              >
                <Globe size={14} className="text-[var(--axion-accent)]" />
                <span className="hidden sm:inline">Visitar Website</span>
                <ExternalLink size={12} className="text-white/40" />
              </a>

              <button
                type="button"
                onClick={() => alert(`A exportar relatório completo de ecossistema digital de ${selectedClient.name}...`)}
                className="px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-white/80 hover:text-white text-xs font-sans border border-white/10 transition-all cursor-pointer flex items-center gap-2"
              >
                <Download size={14} className="text-white/60" />
                <span>Exportar Relatório</span>
              </button>
            </div>
          </div>

          {/* Hero Header do Ecossistema */}
          <div className="p-6 md:p-8 rounded-3xl bg-white/[0.02] border border-white/10 relative overflow-hidden backdrop-blur-md">
            
            {/* Ambient Glow */}
            <div 
              className="absolute -top-12 -right-12 w-72 h-72 rounded-full pointer-events-none opacity-20"
              style={{
                background: `radial-gradient(circle, ${selectedClient.brandColor} 0%, transparent 70%)`,
                filter: "blur(50px)"
              }}
            />

            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 relative z-10">
              
              <div className="flex items-start gap-5">
                <CompanyBrandLogo client={selectedClient} size="xl" />

                <motion.div 
                  initial={{ opacity: 0, x: -28 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="flex flex-col gap-1.5"
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-2xl md:text-3xl font-bold text-white font-sans tracking-tight uppercase">
                      {selectedClient.name}, <span className="text-white/70 font-normal">FICHA EXECUTIVA</span>
                    </h1>
                    <span className="text-[10px] font-mono text-white/50 bg-white/5 border border-white/10 px-2.5 py-0.5 rounded-full">
                      {selectedClient.reference}
                    </span>
                    <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full font-semibold border ${
                      selectedClient.status === "Ativo"
                        ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"
                        : "text-amber-400 bg-amber-400/10 border-amber-400/20"
                    }`}>
                      {selectedClient.status}
                    </span>
                  </div>

                  <span className="text-xs text-white/60 font-sans">
                    {selectedClient.legalName} • <span className="font-mono text-white/40">NIF: {selectedClient.vatNumber}</span>
                  </span>

                  <div className="flex items-center gap-4 text-xs text-white/50 font-sans mt-2 flex-wrap">
                    <span className="flex items-center gap-1.5">
                      <Globe size={13} className="text-[var(--axion-accent)]" />
                      {selectedClient.website.replace("https://", "")}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1.5">
                      <Calendar size={13} className="text-emerald-400" />
                      Cliente desde {selectedClient.clientSince}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1.5">
                      <UserCheck size={13} className="text-purple-400" />
                      Account: {selectedClient.accountManager}
                    </span>
                  </div>
                </motion.div>
              </div>

              {/* KPIs de Retainer e Investimento em Ads */}
              <div className="flex items-center gap-4 shrink-0 bg-white/[0.02] border border-white/5 p-3.5 rounded-2xl">
                <div className="flex flex-col">
                  <span className="text-[10px] font-mono text-white/40 uppercase">MRR Retainer</span>
                  <span className="text-sm md:text-base font-bold text-white font-mono">{selectedClient.mrrValue.split("/")[0]}</span>
                </div>
                <div className="w-[1px] h-8 bg-white/10" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-mono text-white/40 uppercase">Media Spend</span>
                  <span className="text-sm md:text-base font-bold text-[var(--axion-accent)] font-mono">{selectedClient.adSpendManaged.split("/")[0]}</span>
                </div>
              </div>
            </div>

            {/* Sub-Navegação por Separadores */}
            <div className="flex items-center gap-2 overflow-x-auto pt-6 mt-6 border-t border-white/10 no-scrollbar">
              {[
                { id: "geral", label: "Visão Geral do Ecossistema", icon: Workflow },
                { id: "metricas", label: "Performance & Métricas Digitais", icon: BarChart3 },
                { id: "contactos", label: `Interlocutores (${selectedClient.contacts.length})`, icon: Users },
                { id: "contratos", label: "Contratos & Faturação", icon: DollarSign },
                { id: "notas", label: `Timeline & Notas (${selectedClient.notes.length})`, icon: MessageSquare },
              ].map((tab) => {
                const isSel = activeDetailTab === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveDetailTab(tab.id as any)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-sans whitespace-nowrap flex items-center gap-2 transition-all cursor-pointer ${
                      isSel
                        ? "bg-white/15 text-white font-bold border border-white/20 shadow-md"
                        : "text-white/50 hover:text-white hover:bg-white/[0.04]"
                    }`}
                  >
                    <Icon size={14} style={{ color: isSel ? accentColor.hex : undefined }} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Conteúdo Dinâmico do Separador Selecionado */}
          <div className="flex flex-col gap-6">

            {/* TAB 1: VISÃO GERAL DO ECOSSISTEMA */}
            {activeDetailTab === "geral" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs font-sans">
                
                {/* Resumo Estratégico & Escopo */}
                <div className="md:col-span-2 p-6 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col gap-4">
                  <span className="text-[11px] font-mono tracking-wider text-white/40 uppercase font-semibold flex items-center gap-2">
                    <Sparkles size={14} className="text-[var(--axion-accent)]" />
                    Estratégia Digital & Posicionamento
                  </span>
                  
                  <p className="text-white/90 text-sm leading-relaxed">
                    {selectedClient.executiveSummary}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-white/5">
                    <div className="flex flex-col gap-1">
                      <span className="text-white/40 text-[11px]">Setor de Atividade</span>
                      <span className="text-white font-medium">{selectedClient.industry}</span>
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-white/40 text-[11px]">Segmento Comercial</span>
                      <span className="text-white font-medium">{selectedClient.segment}</span>
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-white/40 text-[11px]">Contacto Comercial de Marketing</span>
                      <span className="text-white font-medium">{selectedClient.generalEmail}</span>
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-white/40 text-[11px]">Telefone Direto</span>
                      <span className="text-white font-medium">{selectedClient.generalPhone}</span>
                    </div>
                  </div>
                </div>

                {/* Documentos & Relatórios no Vault */}
                <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col gap-3">
                  <span className="text-[11px] font-mono text-white/40 uppercase font-semibold flex items-center gap-2">
                    <FileCheck size={14} className="text-emerald-400" />
                    Relatórios & Documentação
                  </span>

                  <div className="flex flex-col gap-2 pt-2">
                    {(selectedClient.associatedDocs || []).length === 0 ? (
                      <span className="text-white/30 text-xs py-4 text-center">Sem relatórios anexados.</span>
                    ) : (
                      (selectedClient.associatedDocs || []).map((doc) => (
                        <a
                          key={doc.id}
                          href={doc.url || undefined}
                          target={doc.url ? "_blank" : undefined}
                          rel={doc.url ? "noreferrer" : undefined}
                          className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between gap-3 hover:bg-white/[0.05] transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <FileText size={15} className="text-[var(--axion-accent)] shrink-0" />
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs text-white font-medium truncate">{doc.name}</span>
                              <span className="text-[10px] font-mono text-white/40">{doc.size}</span>
                            </div>
                          </div>
                          {doc.url && <ExternalLink size={13} className="text-white/40 hover:text-white cursor-pointer shrink-0" />}
                        </a>
                      ))
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* TAB 2: PERFORMANCE & MÉTRICAS DIGITAIS */}
            {activeDetailTab === "metricas" && (
              <div className="flex flex-col gap-6">
                
                {/* 4 Cards de Métricas de Alta Conversão */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  
                  {/* Metric 1: Leads Mensais */}
                  <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col justify-between gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/50 font-sans">Leads Geradas</span>
                      <MousePointerClick size={16} className="text-[var(--axion-accent)]" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-2xl md:text-3xl font-bold font-mono text-white">
                        {selectedClient.monthlyLeads}
                      </span>
                      <span className="text-[11px] text-emerald-400 font-sans mt-0.5">
                        ↑ +18.4% vs mês anterior
                      </span>
                    </div>
                  </div>

                  {/* Metric 2: Tráfego Orgânico (SEO) */}
                  <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col justify-between gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/50 font-sans">Tráfego Orgânico (SEO)</span>
                      <LineChart size={16} className="text-emerald-400" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-2xl md:text-3xl font-bold font-mono text-emerald-400">
                        {selectedClient.monthlyOrganicTraffic}
                      </span>
                      <span className="text-[11px] text-white/40 font-sans mt-0.5">
                        Google Search & Bing
                      </span>
                    </div>
                  </div>

                  {/* Metric 3: ROAS Médio em Ads */}
                  <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col justify-between gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/50 font-sans">Retorno em Ads (ROAS)</span>
                      <BarChart3 size={16} className="text-amber-400" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-2xl md:text-3xl font-bold font-mono text-amber-400">
                        {selectedClient.averageRoas}
                      </span>
                      <span className="text-[11px] text-white/40 font-sans mt-0.5">
                        Meta & Google Ads
                      </span>
                    </div>
                  </div>

                  {/* Metric 4: Taxa de Conversão */}
                  <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col justify-between gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/50 font-sans">Taxa de Conversão (CVR)</span>
                      <Target size={16} className="text-purple-400" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-2xl md:text-3xl font-bold font-mono text-white">
                        {selectedClient.conversionRate}
                      </span>
                      <span className="text-[11px] text-purple-400 font-sans mt-0.5">
                        Funil de Aquisição
                      </span>
                    </div>
                  </div>

                </div>

              </div>
            )}

            {/* TAB 5: INTERLOCUTORES & CONTACTOS */}
            {activeDetailTab === "contactos" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {selectedClient.contacts.map((contact, idx) => (
                  <div
                    key={idx}
                    className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col justify-between gap-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-white font-sans">{contact.name}</span>
                        <span className="text-xs text-white/50">{contact.role}</span>
                      </div>
                      {contact.isPrimary && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-mono text-emerald-400 bg-emerald-400/10 border border-emerald-400/20">
                          Principal
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 pt-3 border-t border-white/5 text-xs text-white/70">
                      <a href={`mailto:${contact.email}`} className="flex items-center gap-2 hover:text-[var(--axion-accent)] transition-colors">
                        <Mail size={13} className="text-white/40" />
                        <span className="truncate">{contact.email}</span>
                      </a>
                      <a href={`tel:${contact.phone}`} className="flex items-center gap-2 hover:text-[var(--axion-accent)] transition-colors">
                        <Phone size={13} className="text-white/40" />
                        <span>{contact.phone}</span>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB 6: CONTRATOS & FINANCEIRO */}
            {activeDetailTab === "contratos" && (
              <div className="flex flex-col gap-6">
                
                {/* Condições Contratuais */}
                <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs">
                  <div className="flex flex-col gap-1">
                    <span className="text-white/40 text-[11px] font-mono uppercase">Modelo de Retainer</span>
                    <span className="text-sm font-bold text-white">{selectedClient.contractType}</span>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-white/40 text-[11px] font-mono uppercase">Próxima Renovação</span>
                    <span className="text-sm font-bold text-emerald-400">{selectedClient.contractRenewal}</span>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-white/40 text-[11px] font-mono uppercase">Condições de Pagamento</span>
                    <span className="text-sm font-bold text-white">{selectedClient.paymentTerms}</span>
                  </div>
                </div>

                <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col gap-4">
                  {clientError && <div role="alert" className="rounded-xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-xs text-rose-200">{clientError}</div>}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <span className="text-xs font-mono uppercase tracking-wider text-white/40 font-semibold">Contratos e documentos</span>
                      <p className="mt-1 text-[11px] text-white/40">Os ficheiros ficam associados ao cliente e são enviados automaticamente para o Google Drive / DOCS.</p>
                    </div>
                    <label className={`flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-white/75 transition-colors hover:bg-white/10 hover:text-white ${contractUploading ? "pointer-events-none opacity-50" : "cursor-pointer"}`}>
                      {contractUploading ? <LoaderCircle size={15} className="animate-spin" /> : <UploadCloud size={15} />}
                      {contractUploading ? "A carregar..." : "Carregar ficheiros"}
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        disabled={contractUploading}
                        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                          const files: File[] = [];
                          for (let index = 0; index < (event.currentTarget.files?.length || 0); index += 1) {
                            const file = event.currentTarget.files?.item(index);
                            if (file) files.push(file);
                          }
                          event.currentTarget.value = "";
                          void handleContractDocumentUpload(files);
                        }}
                      />
                    </label>
                  </div>

                  <div className="flex flex-col gap-2">
                    {(selectedClient.associatedDocs || []).length === 0 ? (
                      <span className="py-4 text-center text-xs text-white/30">Sem contratos ou documentos associados.</span>
                    ) : selectedClient.associatedDocs.map((doc) => (
                      <a
                        key={doc.id}
                        href={doc.url || undefined}
                        target={doc.url ? "_blank" : undefined}
                        rel={doc.url ? "noreferrer" : undefined}
                        className={`flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3.5 text-xs transition-colors ${doc.url ? "hover:bg-white/[0.05]" : "cursor-default"}`}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <FileText size={15} className="shrink-0 text-[var(--axion-accent)]" />
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate font-medium text-white">{doc.name}</span>
                            <span className="font-mono text-[10px] text-white/40">{doc.type} · {doc.size}</span>
                          </div>
                        </div>
                        {doc.url && <ExternalLink size={13} className="shrink-0 text-white/40" />}
                      </a>
                    ))}
                  </div>
                </div>

                {/* Histórico de Faturas Emitidas */}
                <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col gap-4">
                  <span className="text-xs font-mono uppercase tracking-wider text-white/40 font-semibold">
                    Faturas de Retainer & Media Spend
                  </span>

                  <div className="flex flex-col gap-2">
                    {selectedClient.invoices.map((inv) => (
                      <div
                        key={inv.id}
                        className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <CreditCard size={15} className="text-white/40" />
                          <span className="font-mono text-white font-medium">{inv.number}</span>
                          <span className="text-white/40">• {inv.date}</span>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-white">{inv.amount}</span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono text-emerald-400 bg-emerald-400/10 border border-emerald-400/20">
                            {inv.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}

            {/* TAB 7: NOTAS & TIMELINE */}
            {activeDetailTab === "notas" && (
              <div className="flex flex-col gap-6">
                
                {/* Form para Adicionar Nota */}
                <form onSubmit={handleAddNote} className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col gap-3">
                  <span className="text-xs font-mono uppercase tracking-wider text-white/40 font-semibold flex items-center gap-2">
                    <Edit3 size={14} className="text-[var(--axion-accent)]" />
                    Adicionar Registo de Alinhamento / Reunião
                  </span>
                  
                  <textarea
                    rows={3}
                    placeholder="Registar nota estratégica, insights de campanhas, testes A/B ou pontos de reunião..."
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    className="w-full p-3.5 rounded-xl bg-white/[0.03] border border-white/10 text-white text-xs font-sans placeholder:text-white/30 focus:outline-none focus:border-[var(--axion-accent)] transition-all resize-none"
                  />

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={!newNoteText.trim()}
                      className="px-4 py-2 rounded-xl bg-[var(--axion-accent)] text-slate-950 font-bold text-xs font-sans hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shadow-md"
                    >
                      Guardar Registo
                    </button>
                  </div>
                </form>

                {/* Lista Cronológica de Notas */}
                <div className="flex flex-col gap-3">
                  {selectedClient.notes.map((note) => (
                    <div
                      key={note.id}
                      className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col gap-2 text-xs"
                    >
                      <div className="flex items-center justify-between text-[11px] text-white/40">
                        <span className="font-bold text-white/80">{note.author}</span>
                        <span className="font-mono">{note.date}</span>
                      </div>
                      <p className="text-white/85 leading-relaxed font-sans">{note.text}</p>
                    </div>
                  ))}
                </div>

              </div>
            )}

          </div>
        </motion.div>
      )}

      {/* Modal administrativo: edição da ficha do cliente */}
      <AnimatePresence>
        {editingClient && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl bg-[#0b0f19] border border-white/15 shadow-2xl"
            >
              <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-white/10 bg-[#0b0f19]/95 px-6 py-5 backdrop-blur-xl">
                <div>
                  <span className="text-[10px] font-mono tracking-[0.25em] text-[var(--axion-accent)] uppercase">Gestão Administrativa</span>
                  <h3 className="mt-1 text-lg font-bold text-white uppercase">Editar ficha do cliente</h3>
                </div>
                <button type="button" onClick={() => setEditingClient(null)} className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors" aria-label="Fechar editor">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveClient} className="flex flex-col gap-6 p-6 text-xs">
                <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:flex-row sm:items-center">
                  <CompanyBrandLogo client={editingClient} size="xl" />
                  <div className="flex flex-1 flex-col gap-1">
                    <span className="font-semibold text-white">Logótipo oficial da empresa</span>
                    <span className="text-[10px] text-white/40">PNG, JPG ou WebP · máximo 5 MB</span>
                  </div>
                  <label className={`flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 font-semibold text-white/75 transition-colors hover:bg-white/10 hover:text-white ${clientSaving ? "pointer-events-none opacity-50" : ""}`}>
                    {clientSaving ? <LoaderCircle size={15} className="animate-spin" /> : <ImageUp size={15} />}
                    Importar logótipo
                    <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => void handleLogoUpload(event.target.files?.[0])} />
                  </label>
                </div>
                {clientError && <div className="rounded-xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-rose-200">{clientError}</div>}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {([
                    ["name", "Nome comercial", "text"],
                    ["legalName", "Denominação legal", "text"],
                    ["vatNumber", "NIF / VAT", "text"],
                    ["industry", "Setor / Indústria", "text"],
                    ["website", "Website", "url"],
                    ["generalEmail", "E-mail geral", "email"],
                    ["generalPhone", "Telefone geral", "text"],
                    ["headquarters", "Sede", "text"],
                    ["clientSince", "Cliente desde", "text"],
                    ["accountManager", "Account Manager", "text"],
                    ["mrrValue", "MRR Retainer", "text"],
                    ["arrValue", "ARR", "text"],
                    ["adSpendManaged", "Media Spend", "text"],
                    ["contractType", "Tipo de contrato", "text"],
                    ["contractRenewal", "Renovação", "text"],
                    ["paymentTerms", "Condições de pagamento", "text"],
                  ] as Array<[keyof ClientRecord, string, string]>).map(([field, label, type]) => (
                    <label key={field} className="flex flex-col gap-1.5 text-white/60">
                      <span>{label}</span>
                      <input
                        type={type}
                        value={String(editingClient[field])}
                        onChange={(event) => updateEditingClient(field, event.target.value as never)}
                        className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-white outline-none transition-colors focus:border-[var(--axion-accent)]"
                      />
                    </label>
                  ))}

                  <label className="flex flex-col gap-1.5 text-white/60">
                    <span>Segmento</span>
                    <select value={editingClient.segment} onChange={(event) => updateEditingClient("segment", event.target.value as ClientRecord["segment"])} className="rounded-xl border border-white/10 bg-[#0e1424] p-3 text-white outline-none focus:border-[var(--axion-accent)]">
                      {SEGMENTS.filter((segment) => segment !== "Todos os Segmentos").map((segment) => <option key={segment} value={segment}>{segment}</option>)}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1.5 text-white/60">
                    <span>Estado</span>
                    <select value={editingClient.status} onChange={(event) => updateEditingClient("status", event.target.value as ClientRecord["status"])} className="rounded-xl border border-white/10 bg-[#0e1424] p-3 text-white outline-none focus:border-[var(--axion-accent)]">
                      {(["Ativo", "Em Onboarding", "Em Otimização", "Renovação"] as ClientRecord["status"][]).map((status) => <option key={status}>{status}</option>)}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1.5 text-white/60">
                    <span>Leads mensais</span>
                    <input type="number" min="0" value={editingClient.monthlyLeads} onChange={(event) => updateEditingClient("monthlyLeads", Number(event.target.value))} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-white outline-none focus:border-[var(--axion-accent)]" />
                  </label>

                  <label className="flex flex-col gap-1.5 text-white/60">
                    <span>Tráfego orgânico</span>
                    <input value={editingClient.monthlyOrganicTraffic} onChange={(event) => updateEditingClient("monthlyOrganicTraffic", event.target.value)} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-white outline-none focus:border-[var(--axion-accent)]" />
                  </label>

                  <label className="flex flex-col gap-1.5 text-white/60">
                    <span>ROAS médio</span>
                    <input value={editingClient.averageRoas} onChange={(event) => updateEditingClient("averageRoas", event.target.value)} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-white outline-none focus:border-[var(--axion-accent)]" />
                  </label>

                  <label className="flex flex-col gap-1.5 text-white/60">
                    <span>Taxa de conversão</span>
                    <input value={editingClient.conversionRate} onChange={(event) => updateEditingClient("conversionRate", event.target.value)} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-white outline-none focus:border-[var(--axion-accent)]" />
                  </label>

                  <label className="flex flex-col gap-1.5 text-white/60 sm:col-span-2 lg:col-span-3">
                    <span>Resumo executivo</span>
                    <textarea rows={4} value={editingClient.executiveSummary} onChange={(event) => updateEditingClient("executiveSummary", event.target.value)} className="resize-none rounded-xl border border-white/10 bg-white/[0.03] p-3 text-white outline-none focus:border-[var(--axion-accent)]" />
                  </label>
                </div>

                <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-white/10 bg-[#0b0f19]/95 pt-5 backdrop-blur-xl">
                  <button type="button" onClick={() => setEditingClient(null)} className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 transition-colors">Cancelar</button>
                  <button type="submit" disabled={clientSaving} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--axion-accent)] text-slate-950 font-bold hover:brightness-110 transition-all disabled:opacity-50">
                    {clientSaving ? <LoaderCircle size={15} className="animate-spin" /> : <Save size={15} />}
                    Guardar alterações
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmação protegida da exclusão do ecossistema */}
      <AnimatePresence>
        {isDeleteModalOpen && selectedClient && CURRENT_USER.hasAllPermissions && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} className="w-full max-w-md rounded-3xl border border-red-400/20 bg-[#0b0f19] p-6 shadow-2xl">
              <div className="flex items-start gap-4">
                <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-red-300"><Trash2 size={21} /></div>
                <div>
                  <span className="text-[10px] font-mono tracking-[0.24em] text-red-300 uppercase">Operação irreversível</span>
                  <h3 className="mt-1 text-lg font-bold text-white">Excluir ecossistema?</h3>
                  <p className="mt-2 text-xs leading-relaxed text-white/60">A ficha de <strong className="text-white">{selectedClient.name}</strong> e os respetivos dados locais serão eliminados.</p>
                </div>
              </div>

              <form onSubmit={handleConfirmDelete} className="mt-6 flex flex-col gap-4">
                <label className="flex flex-col gap-2 text-xs text-white/70">
                  <span className="flex items-center gap-2"><KeyRound size={14} /> Introduz a tua AX PASSKEY para confirmar</span>
                  <input
                    type="password"
                    autoComplete="off"
                    autoFocus
                    value={deletePasskey}
                    onChange={(event) => { setDeletePasskey(event.target.value); setDeleteError(""); }}
                    placeholder="AX-PASSKEY-••••-•••••"
                    className={`rounded-xl border bg-white/[0.03] p-3 font-mono text-white outline-none ${deleteError ? "border-red-400/60" : "border-white/10 focus:border-red-400/50"}`}
                  />
                  {deleteError && <span className="flex items-center gap-1.5 text-[11px] text-red-300"><AlertCircle size={13} />{deleteError}</span>}
                </label>

                <div className="flex justify-end gap-3 border-t border-white/10 pt-4">
                  <button type="button" onClick={() => { setIsDeleteModalOpen(false); setDeletePasskey(""); setDeleteError(""); }} className="px-4 py-2.5 rounded-xl bg-white/5 text-white/70 hover:bg-white/10 transition-colors">Cancelar</button>
                  <button type="submit" disabled={!deletePasskey.trim()} className="flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 font-bold text-white transition-all hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-35">
                    <Trash2 size={14} /> Excluir definitivamente
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL: REGISTAR NOVO CLIENTE / ECOSSISTEMA DIGITAL                        */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isNewClientModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl p-6 md:p-8 rounded-3xl bg-[#0b0f19] border border-white/15 shadow-2xl flex flex-col gap-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <Workflow size={20} className="text-[var(--axion-accent)]" />
                  <h3 className="text-lg font-bold text-white font-sans tracking-tight uppercase">
                    NOVO ECOSSISTEMA, <span className="text-white/70 font-normal">REGISTO DE CLIENTE</span>
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNewClientModalOpen(false)}
                  className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateClient} className="flex flex-col gap-4 text-xs">
                {clientError && <div className="flex items-center gap-2 rounded-xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-rose-200"><AlertCircle size={14} />{clientError}</div>}
                <div className="grid grid-cols-1 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-white/60 font-sans">Nome da Empresa *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Solaris Tech Lda."
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      className="p-3 rounded-xl bg-white/[0.03] border border-white/10 text-white font-sans focus:outline-none focus:border-[var(--axion-accent)]"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-white/60 font-sans">NIF / VAT</label>
                    <input
                      type="text"
                      placeholder="Ex: PT 512 345 678"
                      value={newClientVat}
                      onChange={(e) => setNewClientVat(e.target.value)}
                      className="p-3 rounded-xl bg-white/[0.03] border border-white/10 text-white font-sans focus:outline-none focus:border-[var(--axion-accent)]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-white/60 font-sans">Segmento</label>
                    <select
                      value={newClientSegment}
                      onChange={(e) => setNewClientSegment(e.target.value as any)}
                      className="p-3 rounded-xl bg-[#0e1424] border border-white/10 text-white font-sans focus:outline-none focus:border-[var(--axion-accent)]"
                    >
                      <option value="Enterprise">Enterprise</option>
                      <option value="Scaleup">Scaleup</option>
                      <option value="E-Commerce">E-Commerce</option>
                      <option value="B2B Corporativo">B2B Corporativo</option>
                      <option value="Institucional">Institucional</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-white/60 font-sans">Setor / Indústria</label>
                    <input
                      type="text"
                      placeholder="Ex: E-Commerce & Retalho"
                      value={newClientIndustry}
                      onChange={(e) => setNewClientIndustry(e.target.value)}
                      className="p-3 rounded-xl bg-white/[0.03] border border-white/10 text-white font-sans focus:outline-none focus:border-[var(--axion-accent)]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-white/60 font-sans">Retainer Mensal (MRR em €)</label>
                    <input
                      type="text"
                      placeholder="Ex: 4500"
                      value={newClientMrr}
                      onChange={(e) => setNewClientMrr(e.target.value)}
                      className="p-3 rounded-xl bg-white/[0.03] border border-white/10 text-white font-sans focus:outline-none focus:border-[var(--axion-accent)]"
                    />
                  </div>

                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-white/60 font-sans">Contacto Principal</label>
                    <input
                      type="text"
                      placeholder="Nome do Diretor / CMO"
                      value={newClientContactName}
                      onChange={(e) => setNewClientContactName(e.target.value)}
                      className="p-3 rounded-xl bg-white/[0.03] border border-white/10 text-white font-sans focus:outline-none focus:border-[var(--axion-accent)]"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-white/60 font-sans">E-mail Comercial</label>
                    <input
                      type="email"
                      placeholder="marketing@empresa.pt"
                      value={newClientEmail}
                      onChange={(e) => setNewClientEmail(e.target.value)}
                      className="p-3 rounded-xl bg-white/[0.03] border border-white/10 text-white font-sans focus:outline-none focus:border-[var(--axion-accent)]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10 mt-2">
                  <button
                    type="button"
                    onClick={() => setIsNewClientModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-xs font-sans transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={clientSaving}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--axion-accent)] text-slate-950 font-bold text-xs font-sans hover:brightness-110 transition-all shadow-lg disabled:opacity-50"
                  >
                    {clientSaving && <LoaderCircle size={14} className="animate-spin" />} Criar Ecossistema
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
