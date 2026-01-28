import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Image as ImageIcon, Upload, Loader2, Trash2 } from "lucide-react";
import type { Image as ImageType } from "@shared/schema";

export default function ImagesPage() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
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
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteMutation.mutate(img.id)}
                      data-testid={`button-delete-${img.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
    </div>
  );
}
