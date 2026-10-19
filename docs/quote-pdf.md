# Quote PDF export

`QuoteEditor` opens `QuotePdfPreview` using the current in-memory draft. Saving is not required before previewing. Download and print use the same generated PDF. Closing and reopening the preview regenerates it from the latest editor values.

The document follows the supplied AXION operation template. `assets/quotes/background.jpg` and `logo.png` are extracted from that template; the full Poppins fonts are included with their OFL license so names, accents and currency symbols remain selectable text. The PDF generator is loaded only when the preview opens. Long text and tables flow onto additional pages with page numbers and repeated table headers.

No VAT fields, calculations or labels are exported, as requested. `quoteDocumentModel` explicitly selects public commercial data and uses `calculateQuoteTotals` so the initial payment, recurring monthly equivalent and discounts match the editor. The initial payment includes the first recurring billing cycle; recurring rows show their actual billing period. The first-year figure is an estimate of project + 12 monthly equivalents - initial discounts. Performance conditions are displayed separately and excluded from guaranteed totals. Internal notes, costs, hours and margins never enter the document model.

The emission date can be changed in the preview. Missing references are shown as RASCUNHO. Payment conditions and client notes come from the draft; placeholder bank details and contractual terms from the original template are not automatically inserted.

Validation: unit tests cover totals, excluded items, performance, unsaved changes and internal-data exclusion. Browser checks cover preview, download, regeneration after changing prices, opening for printing, and keyboard dismissal. PDF fixtures with standard, mixed-period, empty and long multi-page data were rendered and checked for text clipping, placeholder content and private-data leakage.
