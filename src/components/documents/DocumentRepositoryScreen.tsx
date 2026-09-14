import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ExternalLink, FileArchive, FileCode, FileImage, FileSpreadsheet, FileText, Folder, FolderArchive, HardDrive, RefreshCw, Search, ShieldCheck, UploadCloud, X } from "lucide-react";
import type { AccentColorOption } from "../../types/settings";
import type { DriveDocument } from "../../server/driveDocument";
import { getDriveUploadAction, type DriveOAuthStatus } from "./driveUploadState";

interface DocumentRepositoryScreenProps {
  accentColor?: AccentColorOption;
  onBackToOverview?: () => void;
  requestedDocument?: string;
  onRequestedDocumentHandled?: () => void;
}

interface DocumentsResponse {
  documents?: DriveDocument[];
  folderUrl?: string;
  syncedAt?: string;
  error?: string;
  detail?: string;
}

const formatDate = (value: string) => value
  ? new Intl.DateTimeFormat("pt-PT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
  : "Data indisponível";

const getCategory = (document: DriveDocument) => {
  if (document.isFolder) return "Pastas";
  if (document.mimeType === "application/pdf") return "PDF";
  if (document.mimeType.includes("spreadsheet") || ["XLS", "XLSX", "CSV"].includes(document.extension)) return "Folhas de cálculo";
  if (document.mimeType.startsWith("image/")) return "Imagens";
  if (["ZIP", "RAR", "7Z"].includes(document.extension)) return "Arquivos";
  return "Documentos";
};

const getIcon = (document: DriveDocument) => {
  if (document.isFolder) return Folder;
  if (document.mimeType.startsWith("image/")) return FileImage;
  if (document.mimeType.includes("spreadsheet") || ["XLS", "XLSX", "CSV"].includes(document.extension)) return FileSpreadsheet;
  if (["ZIP", "RAR", "7Z"].includes(document.extension)) return FileArchive;
  if (["JS", "TS", "JSON", "HTML", "CSS"].includes(document.extension)) return FileCode;
  return FileText;
};

const getColor = (document: DriveDocument) => {
  if (document.isFolder) return "#f59e0b";
  if (document.mimeType === "application/pdf") return "#ef4444";
  if (document.mimeType.includes("spreadsheet")) return "#10b981";
  if (document.mimeType.startsWith("image/")) return "#8b5cf6";
  return "#3b82f6";
};

export default function DocumentRepositoryScreen({
  accentColor = { id: "axion-blue", name: "AXION Blue", hex: "#00f0ff", secondary: "#0284c7", glow: "rgba(0, 240, 255, 0.4)" },
  onBackToOverview,
  requestedDocument = "",
  onRequestedDocumentHandled,
}: DocumentRepositoryScreenProps) {
  const [documents, setDocuments] = useState<DriveDocument[]>([]);
  const [folderUrl, setFolderUrl] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todos");
  const [preview, setPreview] = useState<DriveDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastSync, setLastSync] = useState("");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [oauthStatus, setOAuthStatus] = useState<DriveOAuthStatus>({ configured: false, connected: false, missingScopes: [] });
  const [oauthMessage, setOAuthMessage] = useState("");

  const loadDocuments = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch("/api/documents");
      const result = await response.json() as DocumentsResponse;
      if (!response.ok || !result.documents) throw new Error(result.detail || result.error || "Não foi possível consultar o Google Drive.");
      setDocuments(result.documents);
      setFolderUrl(result.folderUrl || "");
      setLastSync(result.syncedAt || new Date().toISOString());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível consultar o Google Drive.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadOAuthStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/google/oauth/status");
      const result = await response.json() as DriveOAuthStatus;
      if (!response.ok) throw new Error("Não foi possível consultar a ligação Google.");
      setOAuthStatus(result);
    } catch {
      setOAuthStatus({ configured: false, connected: false, missingScopes: [] });
    }
  }, []);

  useEffect(() => {
    void loadDocuments();
    void loadOAuthStatus();
    const params = new URLSearchParams(window.location.search);
    const result = params.get("google-drive");
    if (result === "connected") setOAuthMessage("Conta Google ligada com sucesso.");
    if (result === "error") setOAuthMessage("A ligação Google não foi concluída. Tenta novamente.");
    if (result) {
      params.delete("google-drive");
      params.delete("reason");
      const queryString = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${queryString ? `?${queryString}` : ""}${window.location.hash}`);
    }
  }, [loadDocuments, loadOAuthStatus]);

  const categories = useMemo(() => ["Todos", ...Array.from(new Set(documents.map(getCategory)))], [documents]);
  const filtered = useMemo(() => documents.filter((document) => {
    const normalized = query.trim().toLocaleLowerCase("pt");
    const matches = !normalized || [document.name, document.description, document.owner, document.extension]
      .some((value) => value.toLocaleLowerCase("pt").includes(normalized));
    return matches && (category === "Todos" || getCategory(document) === category);
  }), [category, documents, query]);
  useEffect(() => {
    const requested = requestedDocument.trim().toLocaleLowerCase("pt");
    if (!requested || !documents.length) return;
    const match = documents.find((document) => document.name.toLocaleLowerCase("pt").includes(requested));
    if (match) setPreview(match);
    else setQuery(requestedDocument);
    onRequestedDocumentHandled?.();
  }, [documents, onRequestedDocumentHandled, requestedDocument]);
  const totalBytes = useMemo(() => documents.reduce((total, document) => total + (document.size || 0), 0), [documents]);
  const totalSize = totalBytes ? `${new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 1 }).format(totalBytes / 1024 / 1024)} MB` : "0 B";
  const openDrive = (document?: DriveDocument) => {
    const url = document?.webViewLink || folderUrl;
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };
  const uploadAction = getDriveUploadAction(oauthStatus);
  const connectGoogleDrive = () => { window.location.assign("/api/google/oauth/start"); };
  const disconnectGoogleDrive = async () => {
    if (!window.confirm("Desligar esta conta Google do AXION OFFICE local?")) return;
    await fetch("/api/google/oauth/disconnect", { method: "POST" });
    setOAuthMessage("Conta Google desligada.");
    await loadOAuthStatus();
  };

  const selectUploadFile = (file?: File) => {
    setUploadError("");
    if (!file) return setUploadFile(null);
    if (file.size === 0) return setUploadError("O ficheiro está vazio.");
    if (file.size > 50 * 1024 * 1024) return setUploadError("O ficheiro excede o limite de 50 MB.");
    setUploadFile(file);
  };

  const uploadDocument = async () => {
    if (!uploadFile || uploadProgress !== null) return;
    setUploadError("");
    setUploadProgress(0);
    try {
      await new Promise<void>((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open("POST", "/api/documents/upload");
        request.setRequestHeader("Content-Type", uploadFile.type || "application/octet-stream");
        request.setRequestHeader("X-File-Name", encodeURIComponent(uploadFile.name));
        request.upload.onprogress = (event) => {
          if (event.lengthComputable) setUploadProgress(Math.round((event.loaded / event.total) * 100));
        };
        request.onerror = () => reject(new Error("A ligação foi interrompida durante o upload."));
        request.onload = () => {
          let result: { document?: DriveDocument; error?: string; detail?: string } = {};
          try { result = JSON.parse(request.responseText); } catch { /* Invalid server response handled below. */ }
          if (request.status < 200 || request.status >= 300 || !result.document) {
            return reject(new Error(result.detail || result.error || "O Google Drive não confirmou o upload."));
          }
          resolve();
        };
        request.send(uploadFile);
      });
      setUploadProgress(100);
      await loadDocuments();
      window.dispatchEvent(new CustomEvent("axion:realtime", { detail: { table: "audit_logs" } }));
      setIsUploadOpen(false);
      setUploadFile(null);
    } catch (uploadFailure) {
      setUploadError(uploadFailure instanceof Error ? uploadFailure.message : "Não foi possível carregar o ficheiro.");
      await loadOAuthStatus();
    } finally {
      setUploadProgress(null);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col py-6 pb-28 relative z-10 select-none">
      <div className="flex flex-col gap-6 pb-6 border-b border-white/10">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {onBackToOverview && <button type="button" onClick={onBackToOverview} className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/5 flex items-center gap-2 text-xs"><ArrowLeft size={16} /><span className="hidden sm:inline">Voltar ao Painel</span></button>}
            <span className="text-[11px] font-mono tracking-widest text-white/40 uppercase">AXION // GOOGLE DRIVE DOCUMENT REPOSITORY</span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void loadDocuments()} disabled={isLoading} className="px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-white/80 text-xs border border-white/10 flex items-center gap-2 disabled:opacity-40"><RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />Sincronizar</button>
            <button type="button" onClick={() => openDrive()} disabled={!folderUrl} className="px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-white/80 text-xs border border-white/10 flex items-center gap-2 disabled:opacity-40"><ExternalLink size={14} />Abrir pasta</button>
            <button type="button" onClick={() => { setUploadError(""); setUploadFile(null); setIsUploadOpen(true); }} style={{ backgroundColor: accentColor.hex, color: "#050609", boxShadow: `0 0 20px ${accentColor.glow}` }} className="px-4 py-2 rounded-xl font-bold text-xs hover:brightness-110 flex items-center gap-2"><UploadCloud size={14} />Carregar Documento</button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pt-2">
          <motion.div initial={{ opacity: 0, x: -28 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight uppercase">DEPÓSITO DE DOCUMENTOS, <span className="text-white/70 font-normal">GOOGLE DRIVE</span></h1>
              <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full flex items-center gap-1.5 font-semibold border ${error ? "text-red-300 bg-red-400/10 border-red-400/20" : "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"}`}><ShieldCheck size={12} />{error ? "LIGAÇÃO INTERROMPIDA" : "DRIVE CONECTADO"}</span>
            </div>
            <p className="text-xs md:text-sm text-white/70 flex items-center gap-2 flex-wrap"><HardDrive size={14} className="text-white/40" /><span className="font-mono text-white/90">AXION / DOCS</span><span className="text-white/30">•</span><span className="text-white/50">{documents.length} itens</span><span className="text-white/30">•</span><span className="text-white/50">{totalSize}</span>{lastSync && <><span className="text-white/30">•</span><span className="text-white/50">Atualizado {formatDate(lastSync)}</span></>}</p>
          </motion.div>
          <div className="hidden lg:flex items-center gap-4 border-l border-white/10 pl-6"><FolderArchive size={28} style={{ color: accentColor.hex }} /><div><div className="text-[10px] font-mono text-white/40 uppercase">Fonte oficial</div><div className="text-sm font-semibold text-white">Google Drive API</div></div></div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 py-4 border-b border-white/10">
        <div className="relative flex-1 max-w-md"><Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" /><input type="text" placeholder="Pesquisar ficheiro, descrição ou proprietário..." value={query} onChange={(event) => setQuery(event.target.value)} className="w-full pl-9 pr-9 py-2 rounded-xl bg-white/[0.03] border border-white/10 text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-[var(--axion-accent)]" />{query && <button type="button" onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"><X size={13} /></button>}</div>
        <div className="flex items-center gap-1.5 overflow-x-auto">{categories.map((item) => <button key={item} type="button" onClick={() => setCategory(item)} className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap border ${category === item ? "bg-white/15 text-white border-white/20" : "text-white/50 border-transparent hover:text-white hover:bg-white/[0.03]"}`}>{item}</button>)}</div>
      </div>

      <div className="flex flex-col divide-y divide-white/5 pt-2">
        {oauthMessage && <div className="my-3 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-xs text-emerald-200">{oauthMessage}</div>}
        {isLoading ? <div className="py-20 flex flex-col items-center gap-3 text-white/45 text-xs"><RefreshCw size={22} className="animate-spin" /><span>A sincronizar com AXION / DOCS...</span></div>
          : error ? <div className="py-16 text-center"><p className="text-sm text-red-200">{error}</p><button type="button" onClick={() => void loadDocuments()} className="mt-4 text-xs text-[var(--axion-accent)] hover:underline">Tentar novamente</button></div>
          : filtered.length === 0 ? <div className="py-16 text-center text-white/40 text-xs">{documents.length ? "Nenhum item corresponde à pesquisa." : "A pasta DOCS está vazia."}</div>
          : filtered.map((document) => {
            const Icon = getIcon(document); const color = getColor(document);
            return <div key={document.id} className="py-4 px-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/[0.02] rounded-xl group">
              <button type="button" onClick={() => setPreview(document)} className="flex items-start gap-4 flex-1 text-left min-w-0"><span className="w-10 h-10 rounded-xl bg-white/5 border flex items-center justify-center shrink-0" style={{ borderColor: `${color}40` }}><Icon size={18} style={{ color }} /></span><span className="flex flex-col gap-1 min-w-0"><span className="flex items-center gap-2.5 flex-wrap"><span className="text-xs font-semibold text-white group-hover:text-[var(--axion-accent)] truncate">{document.name}</span><span className="text-[10px] font-mono text-white/50 bg-white/5 px-2 rounded">{document.extension}</span></span><span className="text-[11px] text-white/50 line-clamp-1">{document.description || (document.isFolder ? "Pasta do Google Drive" : "Ficheiro armazenado em AXION / DOCS")}</span><span className="flex items-center gap-3 text-[10px] font-mono text-white/40 flex-wrap"><span>{getCategory(document)}</span><span>•</span><span>{document.sizeLabel}</span><span>•</span><span>{document.owner}</span><span>•</span><span>{formatDate(document.modifiedTime)}</span></span></span></button>
              <button type="button" onClick={() => openDrive(document)} className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/10 text-white/70 hover:text-white text-xs flex items-center gap-1.5 self-end sm:self-center"><ExternalLink size={13} />Abrir no Drive</button>
            </div>;
          })}
      </div>

      <AnimatePresence>{preview && <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"><motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-lg bg-[#0c1017] border border-white/15 rounded-3xl p-6 shadow-2xl flex flex-col gap-5">
        <div className="flex items-start justify-between border-b border-white/10 pb-4"><div className="flex items-center gap-3 min-w-0">{React.createElement(getIcon(preview), { size: 22, style: { color: getColor(preview) } })}<div className="min-w-0"><h3 className="text-sm font-bold text-white truncate">{preview.name}</h3><span className="text-[11px] font-mono text-white/50">{preview.extension} • {preview.sizeLabel}</span></div></div><button type="button" onClick={() => setPreview(null)} className="p-1 text-white/40 hover:text-white"><X size={16} /></button></div>
        <div className="grid grid-cols-2 gap-3 text-xs"><div className="col-span-2 p-3.5 rounded-xl bg-white/[0.03] border border-white/5"><div className="text-[10px] font-mono text-white/40 uppercase mb-1">Descrição</div><p className="text-white/80">{preview.description || "Sem descrição no Google Drive."}</p></div><div className="p-3 rounded-xl bg-white/[0.03] border border-white/5"><div className="text-[10px] font-mono text-white/40 uppercase mb-1">Proprietário</div><div className="text-white">{preview.owner}</div></div><div className="p-3 rounded-xl bg-white/[0.03] border border-white/5"><div className="text-[10px] font-mono text-white/40 uppercase mb-1">Modificado</div><div className="text-white">{formatDate(preview.modifiedTime)}</div></div></div>
        <div className="flex justify-end pt-3 border-t border-white/10"><button type="button" onClick={() => openDrive(preview)} style={{ backgroundColor: accentColor.hex, color: "#050609" }} className="px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 hover:brightness-110"><ExternalLink size={14} />Abrir no Google Drive</button></div>
      </motion.div></div>}</AnimatePresence>

      <AnimatePresence>{isUploadOpen && <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"><motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-lg bg-[#0c1017] border border-white/15 rounded-3xl p-6 shadow-2xl flex flex-col gap-5">
        <div className="flex items-center justify-between border-b border-white/10 pb-4"><div><div className="text-[10px] font-mono text-[var(--axion-accent)] uppercase">Google Drive // AXION / DOCS</div><h3 className="mt-1 text-base font-bold text-white uppercase">Carregar documento</h3></div><button type="button" disabled={uploadProgress !== null} onClick={() => setIsUploadOpen(false)} className="p-1.5 text-white/40 hover:text-white disabled:opacity-30"><X size={17} /></button></div>
        {oauthStatus.connected && <div className="flex items-center justify-between rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2.5 text-xs"><span className="text-emerald-200">Ligado como <strong>{oauthStatus.email || "Conta Google"}</strong></span><button type="button" onClick={() => void disconnectGoogleDrive()} className="text-white/50 hover:text-white">Desligar</button></div>}
        {uploadAction === "configure" && <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2.5 text-xs text-amber-100">OAuth Google ainda não está configurado no servidor local. Adiciona o Client ID e Client Secret ao ficheiro <code>.env</code> e reinicia o servidor.</div>}
        <label onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); selectUploadFile(event.dataTransfer.files[0]); }} className="min-h-48 rounded-2xl border-2 border-dashed border-white/15 bg-white/[0.02] hover:border-[var(--axion-accent)] flex flex-col items-center justify-center gap-3 p-6 cursor-pointer transition-colors">
          <input type="file" className="sr-only" disabled={uploadProgress !== null} onChange={(event) => selectUploadFile(event.target.files?.[0])} />
          <span className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 grid place-items-center"><UploadCloud size={23} style={{ color: accentColor.hex }} /></span>
          {uploadFile ? <><span className="text-sm font-semibold text-white text-center break-all">{uploadFile.name}</span><span className="text-[11px] font-mono text-white/45">{new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 1 }).format(uploadFile.size / 1024 / 1024)} MB</span></> : <><span className="text-sm font-semibold text-white">Arraste um ficheiro ou clique para selecionar</span><span className="text-[11px] font-mono text-white/40">UM FICHEIRO • MÁXIMO 50 MB</span></>}
        </label>
        {uploadProgress !== null && <div className="flex flex-col gap-2"><div className="flex justify-between text-[11px] font-mono text-white/60"><span>A enviar para o Google Drive...</span><span>{uploadProgress}%</span></div><div className="h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-[var(--axion-accent)] transition-[width]" style={{ width: `${uploadProgress}%` }} /></div></div>}
        {uploadError && <div role="alert" className="rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2.5 text-xs text-red-200">{uploadError}</div>}
        <div className="flex justify-end gap-3 border-t border-white/10 pt-4"><button type="button" disabled={uploadProgress !== null} onClick={() => setIsUploadOpen(false)} className="px-4 py-2 text-xs text-white/60 hover:text-white disabled:opacity-30">Cancelar</button>{uploadAction === "upload" ? <button type="button" disabled={!uploadFile || uploadProgress !== null} onClick={() => void uploadDocument()} style={{ backgroundColor: accentColor.hex, color: "#050609" }} className="px-5 py-2 rounded-xl text-xs font-bold hover:brightness-110 disabled:opacity-40">{uploadProgress !== null ? "A carregar..." : "Carregar para DOCS"}</button> : uploadAction === "connect" ? <button type="button" onClick={connectGoogleDrive} style={{ backgroundColor: accentColor.hex, color: "#050609" }} className="px-5 py-2 rounded-xl text-xs font-bold hover:brightness-110">Ligar Google Drive</button> : null}</div>
      </motion.div></div>}</AnimatePresence>
    </div>
  );
}
