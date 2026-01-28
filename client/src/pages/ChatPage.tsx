import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Send, Paperclip, FileText, Image, X, Loader2 } from "lucide-react";
import type { SearchHistory } from "@shared/schema";

interface Message {
  id: string;
  type: "user" | "assistant";
  content: string;
  query?: string;
  results?: any;
  executionTime?: number;
  attachments?: { type: "pdf" | "image"; name: string; id?: string }[];
  timestamp: Date;
}

export default function ChatPage() {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [conversationContext, setConversationContext] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  const { data: history } = useQuery<SearchHistory[]>({
    queryKey: ["/api/search/history"],
  });

  useEffect(() => {
    const handleNewChat = () => {
      setMessages([]);
      setQuery("");
      setAttachments([]);
      setConversationContext("");
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
            type: "user" as const,
            content: conversationData.query,
            timestamp: new Date(conversationData.createdAt),
          },
          {
            id: `assistant-${conversationData.id}`,
            type: "assistant" as const,
            content: results?.answer || "No response available",
            results: results,
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

  const uploadFile = async (file: File) => {
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
      throw new Error("Upload failed");
    }
    
    return response.json();
  };

  const searchMutation = useMutation({
    mutationFn: async (searchQuery: string) => {
      const fullQuery = conversationContext 
        ? `Follow-up question (previous context: ${conversationContext.slice(0, 300)}): ${searchQuery}`
        : searchQuery;
      return apiRequest("/api/search/query", {
        method: "POST",
        body: JSON.stringify({ query: fullQuery }),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/search/history"] });
      
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        type: "assistant",
        content: data.answer || "I found some results for your query.",
        results: data,
        executionTime: data.executionTime,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      
      setConversationContext((prev) => 
        (prev + " " + data.answer).slice(-1000)
      );
    },
    onError: (error: any) => {
      toast({
        title: "Search Failed",
        description: error.message,
        variant: "destructive",
      });
      
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        type: "assistant",
        content: `Sorry, I encountered an error: ${error.message}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() && attachments.length === 0) return;

    const uploadedAttachments: { type: "pdf" | "image"; name: string; id?: string }[] = [];
    
    if (attachments.length > 0) {
      setIsUploading(true);
      try {
        for (const file of attachments) {
          const result = await uploadFile(file);
          uploadedAttachments.push({
            type: file.type === "application/pdf" ? "pdf" : "image",
            name: file.name,
            id: result.id,
          });
        }
        queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
        queryClient.invalidateQueries({ queryKey: ["/api/images"] });
      } catch (error) {
        toast({
          title: "Upload Failed",
          description: "Failed to upload attachments",
          variant: "destructive",
        });
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

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
      searchMutation.mutate(query);
    } else if (uploadedAttachments.length > 0) {
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        type: "assistant",
        content: `I've uploaded ${uploadedAttachments.length} file(s) successfully. You can now ask questions about these documents, and I'll include their content in my analysis.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter((file) => {
      const isPDF = file.type === "application/pdf";
      const isImage = file.type.startsWith("image/");
      return isPDF || isImage;
    });
    setAttachments((prev) => [...prev, ...validFiles]);
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const formatApiResults = (results: any) => {
    if (!results) return null;
    
    const apiResults = results.apiResults || [];
    const pdfResults = results.pdfResults || [];
    const imageResults = results.imageResults || [];
    
    const priceData = apiResults.find((api: any) => api.data?.currentPrice);
    const hasRealData = priceData && priceData.data?.currentPrice;
    
    if (!hasRealData && pdfResults.length === 0 && imageResults.length === 0) {
      return null;
    }
    
    return (
      <div className="mt-4 space-y-4">
        {hasRealData && (
          <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">🌾</span>
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">Market Data</span>
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
                    {priceData.data.currency || ''} {priceData.data.currentPrice.toLocaleString()}/{priceData.data.unit || 'kg'}
                  </p>
                </div>
              )}
              {priceData.data.averagePrice && (
                <div>
                  <p className="text-gray-500 dark:text-gray-400 text-xs">Average Price</p>
                  <p className="font-medium text-gray-800 dark:text-gray-200">
                    {priceData.data.currency || ''} {priceData.data.averagePrice.toLocaleString()}/{priceData.data.unit || 'kg'}
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
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-blue-600" />
              <span className="font-semibold text-blue-700 dark:text-blue-400">Document Insights</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Found relevant content in {pdfResults.length} document(s)
            </p>
          </div>
        )}
        
        {imageResults.length > 0 && (
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Image className="w-4 h-4 text-purple-600" />
              <span className="font-semibold text-purple-700 dark:text-purple-400">Image Analysis</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Analyzed {imageResults.length} image(s)
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] max-w-4xl mx-auto">
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto scrollbar-hide px-4 py-6 space-y-6"
      >
        {messages.length === 0 && (
          <div className="text-center py-16 space-y-6">
            <h1 className="text-3xl font-bold text-white" data-testid="heading-chat">
              What would you like to know?
            </h1>
            <p className="text-gray-400 max-w-lg mx-auto">
              Ask anything about agriculture, climate, or market data. You can also attach PDFs and images for analysis.
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
              className={`max-w-[85%] rounded-2xl px-5 py-4 ${
                message.type === "user"
                  ? "bg-emerald-500 text-white"
                  : "bg-[#2a3749] text-white"
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
                      {att.type === "pdf" ? (
                        <FileText className="w-3 h-3" />
                      ) : (
                        <Image className="w-3 h-3" />
                      )}
                      {att.name}
                    </div>
                  ))}
                </div>
              )}
              
              <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
              
              {message.type === "assistant" && message.results && (
                formatApiResults(message.results)
              )}
              
              {message.executionTime && (
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
              <span className="text-gray-300">Searching agriculture data...</span>
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
                {file.type === "application/pdf" ? (
                  <FileText className="w-4 h-4 text-blue-400" />
                ) : (
                  <Image className="w-4 h-4 text-purple-400" />
                )}
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
            accept=".pdf,image/*"
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
            disabled={searchMutation.isPending || isUploading || (!query.trim() && attachments.length === 0)}
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
