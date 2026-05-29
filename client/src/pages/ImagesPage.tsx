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
import { AnalysisPreview } from "@/components/AnalysisPreview";
import { FormatChatContent } from "@/lib/formatChatContent";
import { uploadsPublicUrl } from "@/lib/chatMessageUtils";
import {
  Image as ImageIcon,
  Loader2,
  Trash2,
  MessageCircle,
  Send,
  Bot,
  User,
} from "lucide-react";
import type { Image as ImageType } from "@shared/schema";
import { authFetchJson } from "@/lib/auth-fetch";
import { errorTitle, getErrorMessage } from "@/lib/api-errors";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ImageQADialogProps {
  img: { id: string; filename: string } | null;
  open: boolean;
  onClose: () => void;
}

function ImageQADialog({ img, open, onClose }: ImageQADialogProps) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setMessages([]);
      setInput("");
    }
  }, [open, img?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const askMutation = useMutation({
    mutationFn: async (question: string) => {
      return authFetchJson<{ answer: string; imageName: string }>(
        `/api/images/${img!.id}/ask`,
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
            <ImageIcon className="h-4 w-4 text-emerald-400 shrink-0" />
            <span className="truncate">{img?.filename}</span>
          </DialogTitle>
          <p className="text-xs text-gray-400 mt-1">
            Ask questions about this image in chat-style Q&amp;A.
          </p>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 gap-2 py-16">
              <MessageCircle className="h-8 w-8 text-emerald-400/60" />
              <p className="text-sm">Ask a question about this image.</p>
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
                  <div className="h-7 w-7 rounded-full bg-[#1e293b] border border-[#3a4759] flex items-center justify-center">
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                  </div>
                  <div className="bg-[#1e293b] border border-[#3a4759] rounded-xl px-4 py-2 text-sm text-gray-400">
                    Thinking…
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </ScrollArea>

        <div className="px-6 pb-6 pt-3 border-t border-[#3a4759] flex gap-2">
          <Input
            placeholder="Ask a question about this image..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={askMutation.isPending}
            className="bg-[#1e293b] border-[#3a4759] text-white placeholder:text-gray-500"
            data-testid="input-image-question"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || askMutation.isPending}
            className="bg-emerald-500 hover:bg-emerald-600 shrink-0"
            data-testid="button-send-image-question"
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

export default function ImagesPage() {
  const { toast } = useToast();
  const [qaImg, setQaImg] = useState<{ id: string; filename: string } | null>(null);
  const { data: images, isLoading } = useQuery<ImageType[]>({ queryKey: ["/api/images/list"] });

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      return authFetchJson("/api/images/upload", { method: "POST", body: formData });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/images/list"] });
      toast({ title: "Success", description: "Image uploaded and analyzed successfully" });
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
      return authFetchJson(`/api/images/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/images/list"] });
      toast({ title: "Success", description: "Image deleted" });
    },
  });

  const handleFileSelected = (picked: File) => {
    const formData = new FormData();
    formData.append("file", picked);
    uploadMutation.mutate(formData);
  };

  return (
    <PageShell
      title="My Images"
      subtitle="Upload agricultural images for AI analysis"
      testId="heading-images"
    >
      <DarkPanel title="Upload image">
        <FileUploadField
          accept="image/jpeg,image/jpg,image/png"
          uploadLabel="Upload image"
          loadingLabel="Uploading & analyzing…"
          emptyHint="No image selected"
          isPending={uploadMutation.isPending}
          onUpload={handleFileSelected}
          testId="button-upload"
        />
      </DarkPanel>

      <DarkPanel title="Uploaded images">
        {isLoading ? (
          <p className="text-gray-400 text-sm">Loading images…</p>
        ) : images?.length === 0 ? (
          <p className="text-gray-400 text-sm">No images uploaded yet.</p>
        ) : (
          <div className="space-y-4">
            {images?.map((img) => (
              <div
                key={img.id}
                className="rounded-xl border border-[#3a4759] bg-[#1e293b]/60 overflow-hidden"
                data-testid={`image-${img.id}`}
              >
                <div className="flex flex-col sm:flex-row gap-4 p-4">
                  <div className="shrink-0 mx-auto sm:mx-0">
                    <img
                      src={uploadsPublicUrl(img.filePath)}
                      alt={img.filename}
                      className="h-28 w-28 sm:h-32 sm:w-32 object-cover rounded-lg border border-[#3a4759] bg-[#141d2b]"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <ImageIcon className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="font-medium text-white truncate">{img.filename}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {(img.fileSize / 1024).toFixed(2)} KB ·{" "}
                            {new Date(img.uploadDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          onClick={() => setQaImg({ id: img.id, filename: img.filename })}
                          className="bg-[#3a4759] hover:bg-[#4a5769] text-white border-0"
                          data-testid={`button-ask-${img.id}`}
                        >
                          <MessageCircle className="h-4 w-4 mr-1" />
                          Ask
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteMutation.mutate(img.id)}
                          className="bg-red-500/90 hover:bg-red-600"
                          data-testid={`button-delete-${img.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {img.extractedData && (
                      <AnalysisPreview text={img.extractedData} title="AI analysis" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </DarkPanel>

      <ImageQADialog img={qaImg} open={qaImg !== null} onClose={() => setQaImg(null)} />
    </PageShell>
  );
}
