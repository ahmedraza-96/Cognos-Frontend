"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, API_URL, getToken } from "@/lib/api";
import { useRequireAuth } from "@/lib/use-require-auth";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface DocumentItem {
  id: string;
  filename: string;
  chunk_count: number;
  created_at: string;
}

interface ChunkItem {
  id: string;
  chunk: number;
  content: string;
}

export default function DocumentsPage() {
  const { user, loading } = useRequireAuth();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [chunks, setChunks] = useState<ChunkItem[]>([]);
  const [chunksLoading, setChunksLoading] = useState(false);
  const [chunksError, setChunksError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setDocuments(await apiFetch<DocumentItem[]>("/documents"));
  }, []);

  useEffect(() => {
    if (user) refresh();
  }, [user, refresh]);

  // Load the selected document's chunks; cancel if the selection changes.
  // When nothing is selected we bail early — ChunkPanel guards on `doc`, so
  // any leftover chunks in state are never rendered.
  useEffect(() => {
    if (!selectedDocId) return;
    let cancelled = false;
    setChunksLoading(true);
    setChunksError(null);
    apiFetch<ChunkItem[]>(`/documents/${selectedDocId}/chunks`)
      .then((data) => {
        if (!cancelled) setChunks(data);
      })
      .catch((err) => {
        if (!cancelled)
          setChunksError(String(err instanceof Error ? err.message : err));
      })
      .finally(() => {
        if (!cancelled) setChunksLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDocId]);

  const selectedDoc = documents.find((d) => d.id === selectedDocId) ?? null;

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      // FormData uploads bypass apiFetch's JSON handling but reuse the token.
      const res = await fetch(`${API_URL}/documents`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: form,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Upload failed (${res.status})`);
      }
      await refresh();
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function remove(id: string) {
    await apiFetch(`/documents/${id}`, { method: "DELETE" });
    if (selectedDocId === id) setSelectedDocId(null);
    await refresh();
  }

  if (loading || !user) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <div className="mx-auto flex w-full max-w-6xl flex-1 overflow-hidden">
        {/* LEFT: upload + document list */}
        <aside className="flex w-full shrink-0 flex-col gap-6 overflow-y-auto p-4 sm:w-96">
          <Card>
            <CardHeader>
              <CardTitle>Upload a document</CardTitle>
              <CardDescription>
                Add .txt, .md, or .pdf files. The agent can search these when you
                chat.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <input
                ref={fileInput}
                type="file"
                accept=".txt,.md,.pdf"
                onChange={onFileSelected}
                disabled={uploading}
                className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
              />
              {uploading && (
                <p className="text-sm text-muted-foreground">
                  Uploading and indexing…
                </p>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
            </CardContent>
          </Card>

          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground">
              Your documents
            </h2>
            {documents.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No documents uploaded yet.
              </p>
            ) : (
              <ul className="divide-y rounded-md border">
                {documents.map((doc) => (
                  <li
                    key={doc.id}
                    className={cn(
                      "flex items-center justify-between gap-3 p-3 transition-colors",
                      selectedDocId === doc.id
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/50",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedDocId(doc.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-sm font-medium">
                        {doc.filename}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {doc.chunk_count} chunk{doc.chunk_count === 1 ? "" : "s"}{" "}
                        indexed
                      </p>
                    </button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => remove(doc.id)}
                    >
                      Delete
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* RIGHT: document preview + chunk viewer */}
        <main className="hidden flex-1 flex-col overflow-hidden p-4 sm:flex">
          {selectedDoc ? (
            <DocumentDetail
              doc={selectedDoc}
              chunks={chunks}
              chunksLoading={chunksLoading}
              chunksError={chunksError}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-center text-muted-foreground">
              <div>
                <p className="text-lg font-medium">Select a document</p>
                <p className="text-sm">
                  Preview it and browse its indexed chunks here.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function DocumentDetail({
  doc,
  chunks,
  chunksLoading,
  chunksError,
}: {
  doc: DocumentItem;
  chunks: ChunkItem[];
  chunksLoading: boolean;
  chunksError: string | null;
}) {
  const [tab, setTab] = useState<"preview" | "chunks">("preview");

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <CardHeader>
        <CardTitle className="truncate">{doc.filename}</CardTitle>
        <CardDescription>
          {doc.chunk_count} chunk{doc.chunk_count === 1 ? "" : "s"} indexed
        </CardDescription>
        <div className="mt-2 flex gap-1">
          <TabButton active={tab === "preview"} onClick={() => setTab("preview")}>
            Preview
          </TabButton>
          <TabButton active={tab === "chunks"} onClick={() => setTab("chunks")}>
            Chunks
          </TabButton>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        {tab === "preview" ? (
          // key forces a fresh fetch (and object-URL cleanup) per document.
          <PreviewPanel key={doc.id} doc={doc} />
        ) : (
          <ChunksList
            chunks={chunks}
            loading={chunksLoading}
            error={chunksError}
          />
        )}
      </CardContent>
    </Card>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-3 py-1 text-sm font-medium transition-colors",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent/50",
      )}
    >
      {children}
    </button>
  );
}

function PreviewPanel({ doc }: { doc: DocumentItem }) {
  const isPdf = doc.filename.split(".").pop()?.toLowerCase() === "pdf";
  const [url, setUrl] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setLoading(true);
    setError(null);
    // An <iframe> can't send the Authorization header, so fetch the file as a
    // blob with the JWT and render it via an object URL (PDF) or text (txt/md).
    fetch(`${API_URL}/documents/${doc.id}/file`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load file (${res.status})`);
        const blob = await res.blob();
        if (cancelled) return;
        if (isPdf) {
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        } else {
          setText(await blob.text());
        }
      })
      .catch((err) => {
        if (!cancelled)
          setError(String(err instanceof Error ? err.message : err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [doc.id, isPdf]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading preview…</p>;
  }
  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }
  if (isPdf && url) {
    return (
      <iframe
        src={url}
        title={doc.filename}
        className="h-full w-full rounded-md border"
      />
    );
  }
  if (text !== null) {
    return (
      <pre className="h-full overflow-auto whitespace-pre-wrap rounded-md border p-3 font-mono text-xs leading-relaxed">
        {text}
      </pre>
    );
  }
  return null;
}

function ChunksList({
  chunks,
  loading,
  error,
}: {
  chunks: ChunkItem[];
  loading: boolean;
  error: string | null;
}) {
  return (
    <div className="h-full space-y-3 overflow-y-auto">
      {loading && (
        <p className="text-sm text-muted-foreground">Loading chunks…</p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!loading && !error && chunks.length === 0 && (
        <p className="text-sm text-muted-foreground">
          This document has no chunks.
        </p>
      )}
      {!loading &&
        !error &&
        chunks.map((c) => (
          <div key={c.id} className="rounded-md border">
            <div className="border-b bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground">
              Chunk {c.chunk + 1}
            </div>
            <pre className="whitespace-pre-wrap px-3 py-2 font-mono text-xs leading-relaxed">
              {c.content}
            </pre>
          </div>
        ))}
    </div>
  );
}
