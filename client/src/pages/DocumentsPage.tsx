import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { FileText, Upload, Loader2, Trash2, MessageCircle, Send, Bot, User } from "lucide-react";

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
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/documents/${doc!.id}/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ question }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Failed to get answer");
      }
      return response.json() as Promise<{ answer: string; documentName: string }>;
    },
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer },
      ]);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
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
      <DialogContent className="max-w-2xl h-[600px] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="truncate">{doc?.filename}</span>
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Ask questions and get answers based on this document's content.
          </p>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground gap-2 py-16">
              <MessageCircle className="h-8 w-8" />
              <p className="text-sm">No messages yet. Ask a question about this document!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                  data-testid={`chat-message-${i}`}
                >
                  <div className="shrink-0 mt-1">
                    {msg.role === "user" ? (
                      <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center">
                        <User className="h-4 w-4 text-primary-foreground" />
                      </div>
                    ) : (
                      <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center">
                        <Bot className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div
                    className={`rounded-lg px-4 py-2 max-w-[80%] text-sm whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {msg.role === "assistant" && (
                      <p className="text-xs font-semibold text-muted-foreground mb-1">
                        From: {doc?.filename}
                      </p>
                    )}
                    {msg.content}
                  </div>
                </div>
              ))}
              {askMutation.isPending && (
                <div className="flex gap-3 flex-row" data-testid="chat-loading">
                  <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-1">
                    <Bot className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="bg-muted rounded-lg px-4 py-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Thinking...
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </ScrollArea>

        <div className="px-6 pb-6 pt-3 border-t flex gap-2">
          <Input
            placeholder="Ask a question about this document..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={askMutation.isPending}
            data-testid="input-document-question"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || askMutation.isPending}
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
  const [file, setFile] = useState<File | null>(null);
  const [qaDoc, setQaDoc] = useState<{ id: string; filename: string } | null>(null);
  const { data: documents, isLoading } = useQuery({ queryKey: ["/api/documents/list"] });

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/documents/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents/list"] });
      toast({ title: "Success", description: "Document uploaded successfully" });
      setFile(null);
    },
    onError: (error: any) => {
      toast({ title: "Upload Failed", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/documents/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents/list"] });
      toast({ title: "Success", description: "Document deleted" });
    },
  });

  const handleUpload = () => {
    if (file) {
      const formData = new FormData();
      formData.append("file", file);
      uploadMutation.mutate(formData);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="heading-documents">My Documents</h1>
        <p className="text-muted-foreground">Upload and manage PDF documents for AI search</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload PDF</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="file"
            accept=".pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            data-testid="input-file-upload"
          />
          <Button
            onClick={handleUpload}
            disabled={!file || uploadMutation.isPending}
            data-testid="button-upload"
          >
            {uploadMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload Document
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Uploaded Documents</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Loading documents...</p>
          ) : documents?.length === 0 ? (
            <p className="text-muted-foreground">No documents uploaded yet</p>
          ) : (
            <div className="space-y-3">
              {documents?.map((doc: any) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                  data-testid={`document-${doc.id}`}
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{doc.filename}</p>
                      <p className="text-xs text-muted-foreground">
                        {(doc.fileSize / 1024).toFixed(2)} KB •{" "}
                        {new Date(doc.uploadDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setQaDoc({ id: doc.id, filename: doc.filename })}
                      data-testid={`button-ask-${doc.id}`}
                    >
                      <MessageCircle className="h-4 w-4 mr-1" />
                      Ask a question
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteMutation.mutate(doc.id)}
                      data-testid={`button-delete-${doc.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <DocumentQADialog
        doc={qaDoc}
        open={qaDoc !== null}
        onClose={() => setQaDoc(null)}
      />
    </div>
  );
}
