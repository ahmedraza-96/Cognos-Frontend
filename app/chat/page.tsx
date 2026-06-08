"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { streamChat } from "@/lib/sse";
import { useRequireAuth } from "@/lib/use-require-auth";
import { cn } from "@/lib/utils";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const TOOL_LABELS: Record<string, string> = {
  search_documents: "Searching your documents",
  calculator: "Calculating",
  current_datetime: "Checking the time",
  http_request: "Calling an API",
  tavily_search_results_json: "Searching the web",
};

export default function ChatPage() {
  const { user, loading } = useRequireAuth();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  const refreshConversations = useCallback(async () => {
    const data = await apiFetch<Conversation[]>("/conversations");
    setConversations(data);
  }, []);

  useEffect(() => {
    if (user) refreshConversations();
  }, [user, refreshConversations]);

  // Load messages when an existing conversation is selected.
  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    apiFetch<ChatMessage[]>(`/conversations/${activeId}/messages`).then((data) => {
      if (!cancelled) setMessages(data);
    });
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streamingText, toolStatus]);

  function newChat() {
    setActiveId(null);
    setMessages([]);
    setStreamingText(null);
    setToolStatus(null);
  }

  async function send() {
    const content = input.trim();
    if (!content || streaming) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content }]);
    setStreamingText("");
    setStreaming(true);

    let acc = "";
    try {
      await streamChat({ content, conversation_id: activeId }, (ev) => {
        if (ev.type === "token") {
          acc += ev.content;
          setStreamingText(acc);
        } else if (ev.type === "tool") {
          setToolStatus(ev.status === "start" ? ev.name : null);
        } else if (ev.type === "done") {
          setMessages((prev) => [...prev, { role: "assistant", content: acc }]);
          setStreamingText(null);
          setToolStatus(null);
          if (!activeId) setActiveId(ev.conversation_id);
          refreshConversations();
        } else if (ev.type === "error") {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: `⚠️ ${ev.message}` },
          ]);
          setStreamingText(null);
        }
      });
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `⚠️ ${String(err)}` },
      ]);
      setStreamingText(null);
      setToolStatus(null);
    } finally {
      setStreaming(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
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
      <div className="mx-auto flex w-full max-w-5xl flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="hidden w-64 shrink-0 flex-col border-r p-3 sm:flex">
          <Button onClick={newChat} className="mb-3 w-full" variant="default">
            + New chat
          </Button>
          <div className="flex-1 space-y-1 overflow-y-auto">
            {conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={cn(
                  "w-full truncate rounded-md px-3 py-2 text-left text-sm transition-colors",
                  activeId === c.id
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/50",
                )}
              >
                {c.title || "Untitled"}
              </button>
            ))}
            {conversations.length === 0 && (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                No conversations yet.
              </p>
            )}
          </div>
        </aside>

        {/* Chat area */}
        <main className="flex flex-1 flex-col">
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.length === 0 && !streamingText && (
              <div className="flex h-full items-center justify-center text-center text-muted-foreground">
                <div>
                  <p className="text-lg font-medium">Ask your agent anything</p>
                  <p className="text-sm">
                    It can search your documents, do math, and browse the web.
                  </p>
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <MessageBubble key={i} role={m.role} content={m.content} />
            ))}

            {toolStatus && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="inline-block size-2 animate-pulse rounded-full bg-blue-500" />
                {TOOL_LABELS[toolStatus] ?? `Using ${toolStatus}`}…
              </div>
            )}

            {streamingText !== null && (
              <MessageBubble role="assistant" content={streamingText || "…"} />
            )}
          </div>

          <div className="border-t p-3">
            <div className="flex items-end gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
                rows={1}
                className="max-h-40 min-h-[44px] resize-none"
              />
              <Button onClick={send} disabled={streaming || !input.trim()}>
                {streaming ? "…" : "Send"}
              </Button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function MessageBubble({
  role,
  content,
}: {
  role: "user" | "assistant";
  content: string;
}) {
  const isUser = role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground",
        )}
      >
        {content}
      </div>
    </div>
  );
}
