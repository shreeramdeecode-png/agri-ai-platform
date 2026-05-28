import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Image as ImageIcon, Upload, Loader2, Trash2, MessageCircle, Send, Bot, User } from "lucide-react";
import type { Image as ImageType } from "@shared/schema";

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
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/images/${img!.id}/ask`, {
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
      return response.json() as Promise<{ answer: string; imageName: string }>;
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
            <ImageIcon className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="truncate">{img?.filename}</span>
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Ask questions and get answers based on this image's content.
          </p>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground gap-2 py-16">
              <MessageCircle className="h-8 w-8" />
              <p className="text-sm">No messages yet. Ask a question about this image!</p>
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
                        From: {img?.filename}
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
            placeholder="Ask a question about this image..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={askMutation.isPending}
            data-testid="input-image-question"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || askMutation.isPending}
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
  const [file, setFile] = useState<File | null>(null);
  const [qaImg, setQaImg] = useState<{ id: string; filename: string } | null>(null);
  const { data: images, isLoading } = useQuery<ImageType[]>({ queryKey: ["/api/images/list"] });

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/images/upload", {
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
      queryClient.invalidateQueries({ queryKey: ["/api/images/list"] });
      toast({ title: "Success", description: "Image uploaded and analyzed successfully" });
      setFile(null);
    },
    onError: (error: any) => {
      toast({ title: "Upload Failed", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/images/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/images/list"] });
      toast({ title: "Success", description: "Image deleted" });
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
        <h1 className="text-3xl font-bold" data-testid="heading-images">My Images</h1>
        <p className="text-muted-foreground">Upload agricultural images for AI analysis</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload Image</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="file"
            accept="image/jpeg,image/jpg,image/png"
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
                Uploading & Analyzing...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload Image
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Uploaded Images</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Loading images...</p>
          ) : images?.length === 0 ? (
            <p className="text-muted-foreground">No images uploaded yet</p>
          ) : (
            <div className="space-y-3">
              {images?.map((img: any) => (
                <div
                  key={img.id}
                  className="p-3 border rounded-lg"
                  data-testid={`image-${img.id}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{img.filename}</p>
                        <p className="text-xs text-muted-foreground">
                          {(img.fileSize / 1024).toFixed(2)} KB •{" "}
                          {new Date(img.uploadDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setQaImg({ id: img.id, filename: img.filename })}
                        data-testid={`button-ask-${img.id}`}
                      >
                        <MessageCircle className="h-4 w-4 mr-1" />
                        Ask a question
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteMutation.mutate(img.id)}
                        data-testid={`button-delete-${img.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {img.extractedData && (
                    <div className="mt-2 p-2 bg-muted rounded text-sm">
                      <p className="font-medium mb-1">AI Analysis:</p>
                      <p className="text-xs">{img.extractedData}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ImageQADialog
        img={qaImg}
        open={qaImg !== null}
        onClose={() => setQaImg(null)}
      />
    </div>
  );
}
