import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Send, Paperclip, FileText, Image, X, Loader2,
  ShieldCheck, AlertTriangle, BookOpen, Globe, Camera, Brain, Hash,
} from "lucide-react";
import type { SearchHistory } from "@shared/schema";

interface CitationEntry {
  id: string;
  label: string;
  source: string;
}

interface StructuredResponse {
  answer: string;
  sections: {
    document?: string | null;
    image?: string | null;
    api?: string | null;
    aiAnalysis?: string | null;
  };
  confidenceScore: string;
  sources: {
    documents: boolean;
    images: boolean;
    api: boolean;
  };
  citations: CitationEntry[];
  grounded: boolean;
  hallucinationDetected: boolean;
}

interface Message {
  id: string;
  type: "user" | "assistant";
  content: string;
  structured?: StructuredResponse;
  documentsFound?: number;
  imagesFound?: number;
  apisFound?: number;
  results?: any;
  executionTime?: number;
  attachments?: { type: "pdf" | "image"; name: string }[];
  timestamp: Date;
}

function ConfidenceBadge({ score }: { score: string }) {
  const num = parseInt(score) || 0;
  const color =
    num >= 90 ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/30"
    : num >= 70 ? "text-yellow-400 bg-yellow-400/10 border-yellow-400/30"
    : "text-red-400 bg-red-400/10 border-red-400/30";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold ${color}`}
      data-testid="badge-confidence"
    >
      <ShieldCheck className="w-3 h-3" />
      {score} confidence
    </span>
  );
}

function SectionBlock({
  icon, title, content, colorClass,
}: {
  icon: React.ReactNode;
  title: string;
  content: string;
  colorClass: string;
}) {
  return (
    <div className={`rounded-xl border p-4 space-y-2 ${colorClass}`}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="font-semibold text-sm">{title}</span>
      </div>
      <p className="text-sm leading-relaxed whitespace-pre-wrap opacity-90">{content}</p>
    </div>
  );
}

function StructuredResponseRenderer({
  structured, documentsFound, imagesFound, apisFound, executionTime,
}: {
  structured: StructuredResponse;
  documentsFound: number;
  imagesFound: number;
  apisFound: number;
  executionTime?: number;
}) {
  const { sections, confidenceScore, citations, hallucinationDetected } = structured;

  // Gate each section on ACTUAL backend counts — never show if no real data
  const showDocument = documentsFound > 0 && sections.document && sections.document.trim().length > 0;
  const showImage    = imagesFound > 0   && sections.image    && sections.image.trim().length > 0;
  const showApi      = apisFound > 0     && sections.api      && sections.api.trim().length > 0;
  const showAnalysis = sections.aiAnalysis && sections.aiAnalysis.trim().length > 0;
  const hasSections  = showDocument || showImage || showApi || showAnalysis;

  return (
    <div className="space-y-3 mt-3">
      {hallucinationDetected && (
        <div className="flex items-center gap-2 text-xs text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 rounded-lg px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          Some claims may not be fully supported by retrieved sources.
        </div>
      )}

      {hasSections && (
        <div className="space-y-3">
          {showDocument && (
            <SectionBlock
              icon={<BookOpen className="w-4 h-4 text-blue-400" />}
              title="Retrieved From Document"
              content={sections.document!}
              colorClass="bg-blue-500/10 border-blue-500/20 text-blue-100"
            />
          )}
          {showImage && (
            <SectionBlock
              icon={<Camera className="w-4 h-4 text-purple-400" />}
              title="Retrieved From Image"
              content={sections.image!}
              colorClass="bg-purple-500/10 border-purple-500/20 text-purple-100"
            />
          )}
          {showApi && (
            <SectionBlock
              icon={<Globe className="w-4 h-4 text-emerald-400" />}
              title="Retrieved From API"
              content={sections.api!}
              colorClass="bg-emerald-500/10 border-emerald-500/20 text-emerald-100"
            />
          )}
          {showAnalysis && (
            <SectionBlock
              icon={<Brain className="w-4 h-4 text-orange-400" />}
              title="AI Analysis"
              content={sections.aiAnalysis!}
              colorClass="bg-orange-500/10 border-orange-500/20 text-orange-100"
            />
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <ConfidenceBadge score={confidenceScore} />
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="font-medium">Sources:</span>
          {documentsFound > 0 && <span className="text-blue-400">📄 {documentsFound} doc{documentsFound !== 1 ? "s" : ""}</span>}
          {imagesFound > 0   && <span className="text-purple-400">🖼 {imagesFound} image{imagesFound !== 1 ? "s" : ""}</span>}
          {apisFound > 0     && <span className="text-emerald-400">🌐 API</span>}
          {documentsFound === 0 && imagesFound === 0 && apisFound === 0 && <span>None</span>}
        </div>
        {executionTime && (
          <span className="text-xs text-gray-500 ml-auto">
            {(executionTime / 1000).toFixed(2)}s
          </span>
        )}
      </div>

      {citations.length > 0 && (
        <div className="bg-[#1a2535] border border-[#2a3749] rounded-xl p-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs text-gray-400 font-semibold mb-2">
            <Hash className="w-3 h-3" />
            Citation Mapping
          </div>
          {citations.map((c) => (
            <div key={c.id} className="text-xs text-gray-300 flex gap-2" data-testid={`citation-${c.id}`}>
              <code className="text-emerald-400 shrink-0">[{c.id}]</code>
              <span className="text-gray-400">→</span>
              <span>{c.label || c.source}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ChatPage() {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [conversationContext, setConversationContext] = useState<string>("");
  // IDs of files uploaded in the CURRENT session (cleared after each send)
  const [sessionDocIds, setSessionDocIds] = useState<string[]>([]);
  const [sessionImgIds, setSessionImgIds] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useQuery<SearchHistory[]>({ queryKey: ["/api/search/history"] });

  useEffect(() => {
    const handleNewChat = () => {
      setMessages([]);
      setQuery("");
      setAttachments([]);
      setConversationContext("");
      setSessionDocIds([]);
      setSessionImgIds([]);
      initialized.current = true;
    };
    window.addEventListener("newChat", handleNewChat);
    return () => window.removeEventListener("newChat", handleNewChat);
  }, []);

  useEffect(() => {
    if (initialized.current) return;
    const activeConversation = localStorage.getItem("activeConversation");
    if (activeConversation) {
      try {
        const conversationData = JSON.parse(activeConversation);
        const results = conversationData.results as any;
        const loadedMessages: Message[] = [
          {
            id: `user-${conversationData.id}`,
            type: "user",
            content: conversationData.query,
            timestamp: new Date(conversationData.createdAt),
          },
          {
            id: `assistant-${conversationData.id}`,
            type: "assistant",
            content: results?.answer || "No response available",
            structured: results?.structured,
            documentsFound: results?.documents_found ?? 0,
            imagesFound: results?.images_found ?? 0,
            apisFound: (results?.apiResults ?? []).length,
            results,
            executionTime: conversationData.executionTime,
            timestamp: new Date(conversationData.createdAt),
          },
        ];
        setMessages(loadedMessages);
        setConversationContext(conversationData.query + " - " + (results?.answer || "").slice(0, 500));
        localStorage.removeItem("activeConversation");
        initialized.current = true;
      } catch (e) {
        console.error("Failed to load conversation", e);
      }
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Upload a file; returns the assigned DB id
  const uploadFile = async (file: File): Promise<{ type: "pdf" | "image"; name: string; id: string }> => {
    const formData = new FormData();
    formData.append("file", file);

    const isPDF = file.type === "application/pdf";
    const endpoint = isPDF ? "/api/documents/upload" : "/api/images/upload";

    const token = localStorage.getItem("token");
    const response = await fetch(endpoint, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || "Upload failed");
    }

    const data = await response.json();
    // Backend returns { document: {...} } for PDFs, { image: {...} } for images
    const id: string = data.document?.id ?? data.image?.id ?? "";
    return { type: isPDF ? "pdf" : "image", name: file.name, id };
  };

  const searchMutation = useMutation({
    mutationFn: async ({
      searchQuery,
      docIds,
      imgIds,
    }: {
      searchQuery: string;
      docIds: string[];
      imgIds: string[];
    }) => {
      const fullQuery = conversationContext
        ? `Follow-up (context: ${conversationContext.slice(0, 300)}): ${searchQuery}`
        : searchQuery;
      return apiRequest("/api/search/query", {
        method: "POST",
        body: JSON.stringify({ query: fullQuery, documentIds: docIds, imageIds: imgIds }),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/search/history"] });

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        type: "assistant",
        content: data.answer || "I found some results for your query.",
        structured: data.structured,
        documentsFound: data.documents_found ?? 0,
        imagesFound: data.images_found ?? 0,
        apisFound: (data.apiResults ?? []).length,
        results: data,
        executionTime: data.executionTime,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setConversationContext((prev) => (prev + " " + data.answer).slice(-1000));
    },
    onError: (error: any) => {
      toast({ title: "Search Failed", description: error.message, variant: "destructive" });
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          type: "assistant",
          content: `Sorry, I encountered an error: ${error.message}`,
          timestamp: new Date(),
        },
      ]);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() && attachments.length === 0) return;

    const newDocIds: string[] = [];
    const newImgIds: string[] = [];
    const uploadedAttachments: { type: "pdf" | "image"; name: string }[] = [];

    if (attachments.length > 0) {
      setIsUploading(true);
      try {
        for (const file of attachments) {
          const result = await uploadFile(file);
          uploadedAttachments.push({ type: result.type, name: result.name });
          if (result.type === "pdf" && result.id) newDocIds.push(result.id);
          else if (result.type === "image" && result.id) newImgIds.push(result.id);
        }
        queryClient.invalidateQueries({ queryKey: ["/api/documents/list"] });
        queryClient.invalidateQueries({ queryKey: ["/api/images/list"] });
      } catch (error: any) {
        toast({
          title: "Upload Failed",
          description: error.message || "Failed to upload one or more files",
          variant: "destructive",
        });
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

    // Accumulate IDs for follow-up queries in the same conversation
    const allDocIds = [...sessionDocIds, ...newDocIds];
    const allImgIds = [...sessionImgIds, ...newImgIds];
    setSessionDocIds(allDocIds);
    setSessionImgIds(allImgIds);

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      type: "user",
      content: query || "Analyze uploaded files",
      attachments: uploadedAttachments.length > 0 ? uploadedAttachments : undefined,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setQuery("");
    setAttachments([]);

    if (query.trim()) {
      searchMutation.mutate({ searchQuery: query, docIds: allDocIds, imgIds: allImgIds });
    } else if (uploadedAttachments.length > 0) {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          type: "assistant",
          content: `Successfully uploaded ${uploadedAttachments.length} file(s). Ask a question to analyse them — I'll cite only these sources.`,
          timestamp: new Date(),
        },
      ]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const valid = files.filter(f => f.type === "application/pdf" || f.type.startsWith("image/"));
    setAttachments((prev) => [...prev, ...valid]);
    // reset the input so the same file can be re-selected
    e.target.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] md:h-[calc(100vh-80px)] max-w-4xl mx-auto pb-16 md:pb-0">
      <div
        className="flex-1 overflow-y-auto scrollbar-hide px-2 md:px-4 py-4 md:py-6 space-y-4 md:space-y-6"
      >
        {messages.length === 0 && (
          <div className="text-center py-16 space-y-6">
            <h1 className="text-3xl font-bold text-white" data-testid="heading-chat">
              What would you like to know?
            </h1>
            <p className="text-gray-400 max-w-lg mx-auto">
              Ask anything about agriculture, climate, or market data. Attach PDFs and images for grounded, cited analysis.
            </p>
            <div className="flex flex-wrap gap-3 justify-center mt-8">
              {["Maize prices in Kenya", "Food security Ethiopia", "Wheat market trends"].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setQuery(suggestion)}
                  className="px-4 py-2 bg-[#2a3749] hover:bg-[#3a4759] text-gray-300 rounded-full text-sm transition-colors"
                  data-testid={`button-suggestion-${suggestion}`}
                >
                  {suggestion}
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
            <div
              className={`max-w-[90%] rounded-2xl px-5 py-4 ${
                message.type === "user" ? "bg-emerald-500 text-white" : "bg-[#2a3749] text-white"
              }`}
              data-testid={`message-${message.type}-${message.id}`}
            >
              {message.attachments && message.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {message.attachments.map((att, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-1 bg-white/20 rounded px-2 py-1 text-xs"
                    >
                      {att.type === "pdf"
                        ? <FileText className="w-3 h-3" />
                        : <Image className="w-3 h-3" />}
                      {att.name}
                    </div>
                  ))}
                </div>
              )}

              <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>

              {message.type === "assistant" && message.structured && (
                <StructuredResponseRenderer
                  structured={message.structured}
                  documentsFound={message.documentsFound ?? 0}
                  imagesFound={message.imagesFound ?? 0}
                  apisFound={message.apisFound ?? 0}
                  executionTime={message.executionTime}
                />
              )}

              {message.type === "assistant" && !message.structured && message.executionTime && (
                <p className="text-xs text-gray-400 mt-3">
                  Searched in {(message.executionTime / 1000).toFixed(2)}s
                </p>
              )}
            </div>
          </div>
        ))}

        {searchMutation.isPending && (
          <div className="flex justify-start">
            <div className="bg-[#2a3749] rounded-2xl px-5 py-4 flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
              <span className="text-gray-300">Retrieving and grounding sources...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-[#3a4759] bg-[#1e293b] p-4">
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {attachments.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 bg-[#2a3749] rounded-lg px-3 py-2 text-sm text-white"
              >
                {file.type === "application/pdf"
                  ? <FileText className="w-4 h-4 text-blue-400" />
                  : <Image className="w-4 h-4 text-purple-400" />}
                <span className="max-w-[150px] truncate">{file.name}</span>
                <button
                  onClick={() => removeAttachment(idx)}
                  className="hover:text-red-400 transition-colors"
                  data-testid={`button-remove-attachment-${idx}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,image/jpeg,image/jpg,image/png"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            className="text-gray-400 hover:text-white hover:bg-[#2a3749]"
            disabled={isUploading}
            data-testid="button-attach-file"
          >
            <Paperclip className="w-5 h-5" />
          </Button>

          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask about agriculture data, or attach a PDF/image..."
            className="flex-1 bg-[#2a3749] border-[#3a4759] text-white h-12 placeholder:text-gray-500"
            disabled={searchMutation.isPending || isUploading}
            data-testid="input-chat-query"
          />

          <Button
            type="submit"
            size="icon"
            className="bg-emerald-500 hover:bg-emerald-600 h-12 w-12"
            disabled={
              searchMutation.isPending ||
              isUploading ||
              (!query.trim() && attachments.length === 0)
            }
            data-testid="button-send-message"
          >
            {isUploading ? (
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
