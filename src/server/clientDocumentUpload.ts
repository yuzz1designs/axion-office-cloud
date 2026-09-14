export async function uploadAndAttachClientDocument<TDocument, TClient>({
  upload,
  attach,
  rollback,
}: {
  upload: () => Promise<TDocument>;
  attach: (document: TDocument) => Promise<TClient>;
  rollback: (document: TDocument) => Promise<void>;
}) {
  const document = await upload();
  try {
    return { document, client: await attach(document) };
  } catch (error) {
    try {
      await rollback(document);
    } catch {
      throw new Error("CLIENT_DOCUMENT_ROLLBACK_FAILED");
    }
    throw error;
  }
}
