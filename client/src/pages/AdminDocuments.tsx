import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";

export default function AdminDocuments() {
  const { data: documents, isLoading } = useQuery({ queryKey: ["/api/admin/documents"] });
  const { data: images } = useQuery({ queryKey: ["/api/admin/images"] });

  if (isLoading) return <div className="p-8">Loading documents...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="heading-documents">Document Management</h1>
        <p className="text-muted-foreground">View all uploaded documents and images</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>PDF Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {documents?.length === 0 ? (
              <p className="text-sm text-muted-foreground">No documents uploaded yet</p>
            ) : (
              documents?.map((doc: any) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 p-3 border rounded-lg"
                  data-testid={`document-${doc.id}`}
                >
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{doc.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      Size: {(doc.fileSize / 1024).toFixed(2)} KB | Uploaded:{" "}
                      {new Date(doc.uploadDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Images</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {images?.length === 0 ? (
              <p className="text-sm text-muted-foreground">No images uploaded yet</p>
            ) : (
              images?.map((img: any) => (
                <div
                  key={img.id}
                  className="flex items-center gap-3 p-3 border rounded-lg"
                  data-testid={`image-${img.id}`}
                >
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{img.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      Size: {(img.fileSize / 1024).toFixed(2)} KB | Uploaded:{" "}
                      {new Date(img.uploadDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
