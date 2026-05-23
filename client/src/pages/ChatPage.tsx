import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Send, Paperclip, FileText, Image, X, Loader2, RefreshCw, Zap, Bot } from "lucide-react";
import type { SearchHistory, ChatSession, ChatMessage } from "@shared/schema";

interface Message {
  id: string;
  type: "user" | "assistant" | "error";
  content: string;
  query?: string;
  results?: any;
  executionTime?: number;
  aiProvider?: string;
  attachments?: { type: "pdf" | "image"; name: string }[];
  timestamp: Date;
  failed?: boolean;
  retryQuery?: string;
}

const PROVIDER_COLORS: Record<string, string> = {
  gemini: "text-blue-400",
  openai: "text-emerald-400",
};

const PROVIDER_ICONS: Record<string, string> = {
  gemini: "✦",
  openai: "⚡",
};

export default function ChatPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [conversationContext, setConversationContext] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  // ─── Load or create chat session ──────────────────────────────────────────
  useEffect(() => {
    if (initialized.current) return;

    const handleNewChat = () => {
      setMessages([]);
      setQuery("");
      setAttachments([]);
      setConversationContext("");
      setSessionId(null);
      initialized.current = true;
      localStorage.removeItem("activeConversation");
      localStorage.removeItem("activeChatSessionId");
    };

    window.addEventListener("newChat", handleNewChat);
    return () => window.removeEventListener("newChat", handleNewChat);
  }, []);

  // Restore active conversation from history click
  useEffect(() => {
    if (initialized.current) return;

    const activeConversation = localStorage.getItem("activeConversation");
    if (activeConversation) {
      try {
        const data = JSON.parse(activeConversation);
        const results = data.results as any;
        setMessages([
          {
            id: `user-${data.id}`,
            type: "user",
            content: data.query,
            timestamp: new Date(data.createdAt),
          },
          {
            id: `assistant-${data.id}`,
            type: "assistant",
            content: results?.answer || "No response available",
            results,
            executionTime: data.executionTime,
            aiProvider: data.agentUsed?.split("/")?.[1],
            timestamp: new Date(data.createdAt),
          },
        ]);
        setConversationContext((data.query + " " + (results?.answer || "")).slice(0, 1000));
        localStorage.removeItem("activeConversation");
        initialized.current = true;
        return;
      } catch { /* ignore */ }
    }

    // Restore active session
    const savedSessionId = localStorage.getItem("activeChatSessionId");
    if (savedSessionId) {
      setSessionId(savedSessionId);
      apiRequest(`/api/chat/sessions/${savedSessionId}`)
        .then(({ messages: msgs }: { session: ChatSession; messages: ChatMessage[] }) => {
          const loaded: Message[] = msgs.map((m) => ({
            id: m.id,
            type: m.role as "user" | "assistant",
            content: m.content,
            results: (m.metadata as any)?.apiResults ? m.metadata : undefined,
            executionTime: (m.metadata as any)?.executionTime,
            aiProvider: (m.metadata as any)?.aiProvider,
            timestamp: new Date(m.createdAt),
          }));
          setMessages(loaded);
          if (msgs.length > 0) {
            const lastPair = msgs.slice(-2);
            setConversationContext(lastPair.map((m) => m.content).join(" ").slice(0, 1000));
          }
        })
        .catch(() => {
          localStorage.removeItem("activeChatSessionId");
        });
    }

    initialized.current = true;
  }, []);

  // Persist session ID
  useEffect(() => {
    if (sessionId) {
      localStorage.setItem("activeChatSessionId", sessionId);
    }
  }, [sessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ─── Helpers ───────────────────────────────────────────────────────────────
  const ensureSession = useCallback(async (): Promise<string> => {
    if (sessionId) return sessionId;
    const session: ChatSession = await apiRequest("/api/chat/sessions", {
      method: "POST",
      body: JSON.stringify({ title: "New Chat" }),
    });
    setSessionId(session.id);
    qc.invalidateQueries({ queryKey: ["/api/chat/sessions"] });
    return session.id;
  }, [sessionId, qc]);

  const uploadFile = async (file: File, onProgress: (pct: number) => void): Promise<any> => {
    const formData = new FormData();
    formData.append("file", file);
    const isPDF = file.type === "application/pdf";
    const endpoint = isPDF ? "/api/documents/upload" : "/api/images/upload";
    const token = localStorage.getItem("token");

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", endpoint);
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          reject(new Error(`Upload failed: ${xhr.statusText}`));
        }
      };

      xhr.onerror = () => reject(new Error("Upload network error"));
      xhr.send(formData);
    });
  };

  // ─── Search mutation ───────────────────────────────────────────────────────
  const searchMutation = useMutation({
    mutationFn: async ({ searchQuery, sid }: { searchQuery: string; sid: string }) => {
      const fullQuery = conversationContext
        ? `Follow-up (context: ${conversationContext.slice(0, 300)}): ${searchQuery}`
        : searchQuery;
      return apiRequest("/api/search/query", {
        method: "POST",
        body: JSON.stringify({ query: fullQuery, sessionId: sid }),
      });
    },
    onSuccess: (data, { searchQuery }) => {
      qc.invalidateQueries({ queryKey: ["/api/search/history"] });
      qc.invalidateQueries({ queryKey: ["/api/chat/sessions"] });

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        type: "assistant",
        content: data.answer || "I found some results for your query.",
        results: data,
        executionTime: data.executionTime,
        aiProvider: data.aiProvider,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setConversationContext((prev) => (prev + " " + data.answer).slice(-1000));
    },
    onError: (error: any, { searchQuery }) => {
      const code = error.message?.includes("DOMAIN_NOT_SUPPORTED")
        ? "Only agriculture queries are supported right now."
        : error.message?.includes("TIMEOUT")
        ? "The request timed out. Please try again."
        : error.message || "Search failed. Please try again.";

      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        type: "error",
        content: code,
        failed: true,
        retryQuery: searchQuery,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);

      toast({ title: "Search Failed", description: code, variant: "destructive" });
    },
  });

  const handleSubmit = async (e: React.FormEvent, retryQuery?: string) => {
    e?.preventDefault();
    const finalQuery = retryQuery || query;
    if (!finalQuery.trim() && attachments.length === 0) return;

    const uploadedAttachments: { type: "pdf" | "image"; name: string }[] = [];

    if (attachments.length > 0) {
      setIsUploading(true);
      setUploadProgress(0);
      try {
        for (let i = 0; i < attachments.length; i++) {
          const file = attachments[i];
          await uploadFile(file, (pct) => {
            setUploadProgress(Math.round(((i + pct / 100) / attachments.length) * 100));
          });
          uploadedAttachments.push({
            type: file.type === "application/pdf" ? "pdf" : "image",
            name: file.name,
          });
        }
        setUploadProgress(100);
        qc.invalidateQueries({ queryKey: ["/api/documents/list"] });
        qc.invalidateQueries({ queryKey: ["/api/images/list"] });
      } catch {
        toast({ title: "Upload Failed", description: "Failed to upload attachments", variant: "destructive" });
        setIsUploading(false);
        setUploadProgress(0);
        return;
      }
      setIsUploading(false);
      setUploadProgress(0);
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      type: "user",
      content: finalQuery || "Analyze uploaded files",
      attachments: uploadedAttachments.length > 0 ? uploadedAttachments : undefined,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!retryQuery) {
      setQuery("");
      setAttachments([]);
    }

    if (finalQuery.trim()) {
      const sid = await ensureSession();
      searchMutation.mutate({ searchQuery: finalQuery, sid });
    } else if (uploadedAttachments.length > 0) {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          type: "assistant",
          content: `${uploadedAttachments.length} file(s) uploaded and chunked for search. Ask me anything about them.`,
          timestamp: new Date(),
        },
      ]);
    }
  };

  const handleRetry = (retryQuery: string) => {
    setMessages((prev) => prev.filter((m) => m.type !== "error" || m.retryQuery !== retryQuery));
    handleSubmit(null as any, retryQuery);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(
      (f) => f.type === "application/pdf" || f.type.startsWith("image/")
    );
    setAttachments((prev) => [...prev, ...files]);
    e.target.value = "";
  };

  const formatApiResults = (results: any) => {
    if (!results) return null;

    const apiResults = results.apiResults || [];
    const pdfResults = results.pdfResults || [];
    const imageResults = results.imageResults || [];
    const priceData = apiResults.find((api: any) => api.data?.currentPrice);

    if (!priceData?.data?.currentPrice && pdfResults.length === 0 && imageResults.length === 0) return null;

    return (
      <div className="mt-4 space-y-3">
        {priceData?.data?.currentPrice && (
          <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">🌾</span>
              <span className="font-semibold text-emerald-700 dark:text-emerald-400 text-sm">Market Data</span>
              <span className="text-xs text-gray-400 ml-auto">HDX HAPI</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {priceData.data.crop && (
                <div>
                  <p className="text-gray-500 dark:text-gray-400 text-xs">Commodity</p>
                  <p className="font-medium text-gray-800 dark:text-gray-200">{priceData.data.crop}</p>
                </div>
              )}
              {priceData.data.country && (
                <div>
                  <p className="text-gray-500 dark:text-gray-400 text-xs">Location</p>
                  <p className="font-medium text-gray-800 dark:text-gray-200">{priceData.data.country}</p>
                </div>
              )}
              {priceData.data.currentPrice && (
                <div>
                  <p className="text-gray-500 dark:text-gray-400 text-xs">Current Price</p>
                  <p className="font-medium text-emerald-600 dark:text-emerald-400">
                    {priceData.data.currency} {priceData.data.currentPrice.toLocaleString()}/{priceData.data.unit}
                  </p>
                </div>
              )}
              {priceData.data.averagePrice && (
                <div>
                  <p className="text-gray-500 dark:text-gray-400 text-xs">Average Price</p>
                  <p className="font-medium text-gray-800 dark:text-gray-200">
                    {priceData.data.currency} {priceData.data.averagePrice.toLocaleString()}/{priceData.data.unit}
                  </p>
                </div>
              )}
              {priceData.data.lastUpdated && (
                <div className="col-span-2">
                  <p className="text-gray-500 dark:text-gray-400 text-xs">Last Updated</p>
                  <p className="font-medium text-gray-800 dark:text-gray-200">
                    {new Date(priceData.data.lastUpdated).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {pdfResults.length > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <span className="text-sm text-blue-700 dark:text-blue-400">
              Retrieved from {pdfResults.length} document chunk(s)
            </span>
          </div>
        )}

        {imageResults.length > 0 && (
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 flex items-center gap-2">
            <Image className="w-4 h-4 text-purple-500 flex-shrink-0" />
            <span className="text-sm text-purple-700 dark:text-purple-400">
              Analyzed {imageResults.length} image(s)
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] md:h-[calc(100vh-80px)] max-w-4xl mx-auto pb-16 md:pb-0">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-2 md:px-4 py-4 md:py-6 space-y-4 md:space-y-6">
        {messages.length === 0 && (
          <div className="text-center py-16 space-y-6">
            <h1 className="text-3xl font-bold text-white" data-testid="heading-chat">
              What would you like to know?
            </h1>
            <p className="text-gray-400 max-w-lg mx-auto">
              Ask anything about agriculture, climate, or market data. Attach PDFs and images for deeper analysis.
            </p>
            <div className="flex flex-wrap gap-3 justify-center mt-8">
              {["Maize prices in Kenya", "Food security Ethiopia", "Wheat market trends"].map((s) => (
                <button
                  key={s}
                  onClick={() => setQuery(s)}
                  className="px-4 py-2 bg-[#2a3749] hover:bg-[#3a4759] text-gray-300 rounded-full text-sm transition-colors"
                  data-testid={`button-suggestion-${s}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}
          >
            {message.type === "error" ? (
              <div className="max-w-[85%] rounded-2xl px-5 py-4 bg-red-900/30 border border-red-700/50 text-white">
                <p className="text-red-300 text-sm">{message.content}</p>
                {message.retryQuery && (
                  <button
                    onClick={() => handleRetry(message.retryQuery!)}
                    className="flex items-center gap-2 mt-3 text-xs text-red-400 hover:text-white transition-colors"
                    data-testid="button-retry"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Retry
                  </button>
                )}
              </div>
            ) : (
              <div
                className={`max-w-[85%] rounded-2xl px-5 py-4 ${
                  message.type === "user"
                    ? "bg-emerald-500 text-white"
                    : "bg-[#2a3749] text-white"
                }`}
                data-testid={`message-${message.type}-${message.id}`}
              >
                {/* Attachments */}
                {message.attachments && message.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {message.attachments.map((att, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-1 bg-white/20 rounded px-2 py-1 text-xs"
                      >
                        {att.type === "pdf" ? <FileText className="w-3 h-3" /> : <Image className="w-3 h-3" />}
                        {att.name}
                      </div>
                    ))}
                  </div>
                )}

                <p className="whitespace-pre-wrap leading-relaxed text-sm md:text-base">{message.content}</p>

                {message.type === "assistant" && message.results && formatApiResults(message.results)}

                {/* Footer: time + AI provider */}
                {message.type === "assistant" && (
                  <div className="flex items-center gap-3 mt-3 pt-2 border-t border-white/10">
                    {message.executionTime && (
                      <span className="text-xs text-gray-400">
                        {(message.executionTime / 1000).toFixed(1)}s
                      </span>
                    )}
                    {message.aiProvider && (
                      <span
                        className={`text-xs flex items-center gap-1 ${PROVIDER_COLORS[message.aiProvider] || "text-gray-400"}`}
                        data-testid="text-ai-provider"
                      >
                        <span>{PROVIDER_ICONS[message.aiProvider] || "○"}</span>
                        {message.aiProvider === "gemini" ? "Gemini 2.0 Flash" : "GPT-4o"}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {searchMutation.isPending && (
          <div className="flex justify-start">
            <div className="bg-[#2a3749] rounded-2xl px-5 py-4 flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
              <span className="text-gray-300 text-sm">Searching agriculture data...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-[#3a4759] bg-[#1e293b] p-4">
        {/* Upload progress */}
        {isUploading && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-400">Uploading files...</span>
              <span className="text-xs text-gray-400">{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} className="h-1.5" />
          </div>
        )}

        {/* Attachments preview */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {attachments.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 bg-[#2a3749] rounded-lg px-3 py-2 text-sm text-white"
              >
                {file.type === "application/pdf" ? (
                  <FileText className="w-4 h-4 text-blue-400" />
                ) : (
                  <Image className="w-4 h-4 text-purple-400" />
                )}
                <span className="max-w-[140px] truncate text-xs">{file.name}</span>
                <button
                  onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                  className="hover:text-red-400 transition-colors"
                  data-testid={`button-remove-attachment-${idx}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,image/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            data-testid="input-file-upload"
          />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            className="text-gray-400 hover:text-white hover:bg-[#2a3749] flex-shrink-0"
            disabled={isUploading}
            data-testid="button-attach-file"
          >
            <Paperclip className="w-5 h-5" />
          </Button>

          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e as any);
              }
            }}
            placeholder="Ask about agriculture data, or attach a PDF/image..."
            className="flex-1 bg-[#2a3749] border-[#3a4759] text-white h-12 placeholder:text-gray-500 text-sm"
            disabled={searchMutation.isPending || isUploading}
            data-testid="input-chat-query"
          />

          <Button
            type="submit"
            size="icon"
            className="bg-emerald-500 hover:bg-emerald-600 h-12 w-12 flex-shrink-0"
            disabled={searchMutation.isPending || isUploading || (!query.trim() && attachments.length === 0)}
            data-testid="button-send-message"
          >
            {searchMutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
