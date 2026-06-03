import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileUploadField } from "@/components/FileUploadField";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { PageShell, DarkPanel } from "@/components/PageShell";
import { FormatChatContent } from "@/lib/formatChatContent";
import {
  FileText,
  Loader2,
  Trash2,
  MessageCircle,
  Send,
  Bot,
  User,
} from "lucide-react";
import type { Document } from "@shared/schema";
import { authFetchJson } from "@/lib/auth-fetch";
import { errorTitle, getErrorMessage } from "@/lib/api-errors";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface DocumentQADialogProps {
  doc: { id: string; filename: string } | null;
  open: boolean;
  onClose: () => void;
}

function DocumentQADialog({ doc, open, onClose }: DocumentQADialogProps) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setMessages([]);
      setInput("");
    }
  }, [open, doc?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const askMutation = useMutation({
    mutationFn: async (question: string) => {
      return authFetchJson<{ answer: string; documentName: string }>(
        `/api/documents/${doc!.id}/ask`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question }),
        },
      );
    },
    onSuccess: (data) => {
      setMessages((prev) => [...prev, { role: "assistant", content: data.answer }]);
    },
    onError: (error: unknown) => {
      toast({
        title: errorTitle(error),
        description: getErrorMessage(error),
        variant: "destructive",
      });
      setMessages((prev) => prev.slice(0, -1));
    },
  });

  const handleSend = () => {
    const question = input.trim();
    if (!question || askMutation.isPending) return;
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setInput("");
    askMutation.mutate(question);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl h-[600px] flex flex-col p-0 bg-[#2a3749] border-[#3a4759] text-white">
        <DialogHeader className="px-6 pt-6 pb-3 border-b border-[#3a4759]">
          <DialogTitle className="flex items-center gap-2 text-base text-white">
            <FileText className="h-4 w-4 text-emerald-400 shrink-0" />
            <span className="truncate">{doc?.filename}</span>
          </DialogTitle>
          <p className="text-xs text-gray-400 mt-1">
            Ask questions about this document.
          </p>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 gap-2 py-16">
              <MessageCircle className="h-8 w-8 text-emerald-400/60" />
              <p className="text-sm">Ask a question about this document.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                >
                  <div className="shrink-0 mt-1">
                    {msg.role === "user" ? (
                      <div className="h-7 w-7 rounded-full bg-emerald-500 flex items-center justify-center">
                        <User className="h-4 w-4 text-white" />
                      </div>
                    ) : (
                      <div className="h-7 w-7 rounded-full bg-[#1e293b] border border-[#3a4759] flex items-center justify-center">
                        <Bot className="h-4 w-4 text-emerald-400" />
                      </div>
                    )}
                  </div>
                  <div
                    className={`rounded-xl px-4 py-3 max-w-[80%] text-sm ${
                      msg.role === "user"
                        ? "bg-emerald-500 text-white"
                        : "bg-[#1e293b] border border-[#3a4759] text-gray-100"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <FormatChatContent content={msg.content} />
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}
              {askMutation.isPending && (
                <div className="flex gap-3">
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                  <span className="text-sm text-gray-400">Thinking…</span>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </ScrollArea>

        <div className="px-6 pb-6 pt-3 border-t border-[#3a4759] flex gap-2">
          <Input
            placeholder="Ask a question about this document..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={askMutation.isPending}
            className="bg-[#1e293b] border-[#3a4759] text-white placeholder:text-gray-500"
            data-testid="input-document-question"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || askMutation.isPending}
            className="bg-emerald-500 hover:bg-emerald-600 shrink-0"
            data-testid="button-send-question"
          >
            {askMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function DocumentsPage() {
  const { toast } = useToast();
  const [qaDoc, setQaDoc] = useState<{ id: string; filename: string } | null>(null);
  const { data: documents, isLoading } = useQuery<Document[]>({
    queryKey: ["/api/documents/list"],
  });

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      return authFetchJson("/api/documents/upload", { method: "POST", body: formData });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents/list"] });
      toast({
        title: "Success",
        description: "Document uploaded and analyzed successfully",
      });
    },
    onError: (error: unknown) => {
      toast({
        title: errorTitle(error),
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return authFetchJson(`/api/documents/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents/list"] });
      toast({ title: "Success", description: "Document deleted" });
    },
  });

  const handleFileSelected = (picked: File) => {
    const formData = new FormData();
    formData.append("file", picked);
    uploadMutation.mutate(formData);
  };

  return (
    <PageShell
      title="My Documents"
      subtitle="Upload and manage PDF documents for AI search"
      testId="heading-documents"
    >
      <DarkPanel title="Upload PDF">
        <FileUploadField
          accept=".pdf,application/pdf"
          uploadLabel="Upload document"
          loadingLabel="Uploading…"
          emptyHint="No PDF selected"
          isPending={uploadMutation.isPending}
          onUpload={handleFileSelected}
          testId="button-upload"
        />
      </DarkPanel>

      <DarkPanel title="Uploaded documents">
        {isLoading ? (
          <p className="text-gray-400 text-sm">Loading documents…</p>
        ) : documents?.length === 0 ? (
          <p className="text-gray-400 text-sm">No documents uploaded yet.</p>
        ) : (
          <div className="space-y-4">
            {documents?.map((doc) => (
              <div
                key={doc.id}
                className="rounded-xl border border-[#3a4759] bg-[#1e293b]/60 overflow-hidden"
                data-testid={`document-${doc.id}`}
              >
                <div className="flex flex-col items-center gap-4 p-4 sm:flex-row sm:items-center">
                  <div className="shrink-0">
                    <div className="h-16 w-16 rounded-lg bg-[#141d2b] border border-[#3a4759] flex items-center justify-center">
                      <FileText className="h-8 w-8 text-emerald-400" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 w-full text-center sm:text-left flex flex-col justify-center">
                    <p className="font-medium text-white break-all sm:truncate">{doc.filename}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {(doc.fileSize / 1024).toFixed(2)} KB ·{" "}
                      {new Date(doc.uploadDate).toLocaleDateString()}
                      {doc.extractedText ? " · Ready for search" : ""}
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2 shrink-0 sm:ml-auto">
                    <Button
                      size="sm"
                      onClick={() => setQaDoc({ id: doc.id, filename: doc.filename })}
                      className="bg-[#3a4759] hover:bg-[#4a5769] text-white border-0"
                      data-testid={`button-ask-${doc.id}`}
                    >
                      <MessageCircle className="h-4 w-4 mr-1" />
                      Ask
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteMutation.mutate(doc.id)}
                      className="bg-red-500/90 hover:bg-red-600"
                      data-testid={`button-delete-${doc.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </DarkPanel>

      <DocumentQADialog doc={qaDoc} open={qaDoc !== null} onClose={() => setQaDoc(null)} />
    </PageShell>
  );
}
