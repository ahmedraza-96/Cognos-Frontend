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

interface DocumentItem {
  id: string;
  filename: string;
  chunk_count: number;
  created_at: string;
}

export default function DocumentsPage() {
  const { user, loading } = useRequireAuth();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setDocuments(await apiFetch<DocumentItem[]>("/documents"));
  }, []);

  useEffect(() => {
    if (user) refresh();
  }, [user, refresh]);

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
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 p-4">
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
                  className="flex items-center justify-between gap-3 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{doc.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc.chunk_count} chunk{doc.chunk_count === 1 ? "" : "s"}{" "}
                      indexed
                    </p>
                  </div>
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
      </main>
    </div>
  );
}
