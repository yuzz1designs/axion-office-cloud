import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, ExternalLink, LoaderCircle, RefreshCw, X } from "lucide-react";
import { quoteDocumentModel, type QuoteDocumentDraft } from "../../lib/quoteDocument";

export default function QuotePdfPreview({ draft, onClose }: {
  draft: QuoteDocumentDraft; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [issuedOn, setIssuedOn] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });
  const filename = `${(draft.reference || "AXION-rascunho").replace(/[^a-zA-Z0-9_-]/g, "-")}-resumo-comercial.pdf`;
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    let disposed = false; let objectUrl = "";
    setLoading(true); setUrl(""); setError("");
    const timer = window.setTimeout(async () => {
      try {
        if (!issuedOn) throw new Error("Indica a data de emissão do documento.");
        const { createQuotePdf, loadQuotePdfAssets } = await import("../../lib/quotePdf");
        const model = quoteDocumentModel(draft, issuedOn);
        const bytes = await createQuotePdf(model, await loadQuotePdfAssets());
        if (disposed) return;
        objectUrl = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }));
        setUrl(objectUrl);
      } catch (caught) {
        if (!disposed) setError(caught instanceof Error ? caught.message : "Não foi possível gerar o PDF.");
      } finally { if (!disposed) setLoading(false); }
    }, 180);
    return () => { disposed = true; window.clearTimeout(timer); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [draft, issuedOn, attempt]);

  return createPortal(<dialog ref={dialog} onCancel={(event) => { event.preventDefault(); onClose(); }} aria-labelledby="quote-pdf-title" className="fixed inset-0 m-auto h-[94dvh] max-h-none w-[min(1200px,96vw)] max-w-none overflow-hidden rounded-2xl border border-white/15 bg-[#0b1017] p-0 text-white shadow-2xl backdrop:bg-black/80">
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div><h2 id="quote-pdf-title" className="text-base font-semibold">Resumo comercial · PDF</h2><p className="mt-1 text-xs text-white/40">Gerado com os dados atuais do orçamento.</p></div>
        <div className="flex items-center gap-2">
          {url && !loading && <><a href={url} download={filename} className="rounded-xl bg-cyan-300 px-3 py-2 text-xs font-semibold text-slate-950"><Download size={14} className="mr-2 inline"/>Descarregar PDF</a><a href={url} target="_blank" rel="noreferrer" className="rounded-xl border border-white/15 px-3 py-2 text-xs text-white/70"><ExternalLink size={14} className="mr-2 inline"/>Abrir para imprimir</a></>}
          <button onClick={onClose} aria-label="Fechar pré-visualização" className="rounded-xl p-2.5 text-white/60 hover:bg-white/10"><X size={18}/></button>
        </div>
      </header>
      <div className="flex flex-wrap items-center gap-5 border-b border-white/10 px-5 py-3">
        <label className="flex items-center gap-2 text-xs text-white/60">Data de emissão<input type="date" value={issuedOn} onChange={(event) => setIssuedOn(event.target.value)} className="rounded-lg border border-white/15 bg-black/20 p-2 text-white [color-scheme:dark]"/></label>
      </div>
      <div className="relative min-h-0 flex-1 bg-[#242424]">
        {loading ? <div role="status" className="flex h-full items-center justify-center gap-3 text-sm text-white/60"><LoaderCircle size={20} className="animate-spin"/>A preparar o PDF…</div>
          : error ? <div role="alert" className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center"><p className="text-sm text-amber-200">{error}</p><button onClick={() => setAttempt((value) => value + 1)} className="rounded-xl border border-white/15 px-4 py-2 text-xs"><RefreshCw size={14} className="mr-2 inline"/>Tentar novamente</button></div>
          : <iframe title="Pré-visualização do resumo comercial" src={`${url}#view=FitH`} className="h-full w-full border-0"/>}
      </div>
    </div>
  </dialog>, document.body);
}
