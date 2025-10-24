import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

export default function AdminSettings() {
  const { toast } = useToast();
  const { data: settings } = useQuery({ queryKey: ["/api/admin/settings"] });
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  const updateSettingMutation = useMutation({
    mutationFn: async (data: { keyName: string; keyValue: string; isActive: boolean }) => {
      return apiRequest("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({ title: "Success", description: "Setting updated" });
      setNewKey("");
      setNewValue("");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettingMutation.mutate({ keyName: newKey, keyValue: newValue, isActive: true });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="heading-settings">Settings</h1>
        <p className="text-muted-foreground">Configure API keys and system settings</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add New API Key</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="key-name" data-testid="label-key-name">Key Name</Label>
                <Input
                  id="key-name"
                  data-testid="input-key-name"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="e.g., FEWSNET_API_KEY"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="key-value" data-testid="label-key-value">Key Value</Label>
                <Input
                  id="key-value"
                  data-testid="input-key-value"
                  type="password"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder="Enter API key"
                />
              </div>
            </div>
            <Button type="submit" data-testid="button-add-setting">Add Setting</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {settings?.map((setting: any) => (
              <div
                key={setting.id}
                className="flex items-center justify-between p-3 border rounded-lg"
                data-testid={`setting-${setting.keyName}`}
              >
                <div>
                  <p className="font-medium">{setting.keyName}</p>
                  <p className="text-xs text-muted-foreground">
                    Updated: {new Date(setting.updatedAt).toLocaleString()}
                  </p>
                </div>
                <Switch
                  checked={setting.isActive}
                  onCheckedChange={(checked) =>
                    updateSettingMutation.mutate({
                      keyName: setting.keyName,
                      keyValue: setting.keyValue,
                      isActive: checked,
                    })
                  }
                  data-testid={`switch-active-${setting.keyName}`}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
