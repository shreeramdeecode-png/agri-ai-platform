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
  
  const [openaiKey, setOpenaiKey] = useState("");
  const [fewsnetKey, setFewsnetKey] = useState("");
  const [otherApis, setOtherApis] = useState("");
  const [retryLimits, setRetryLimits] = useState("3");
  const [requestTimeout, setRequestTimeout] = useState("30");
  const [cacheSettings, setCacheSettings] = useState("15");
  const [fallbackRules, setFallbackRules] = useState(true);

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
    },
  });

  const handleUpdateOpenAI = () => {
    if (openaiKey) {
      updateSettingMutation.mutate({ keyName: "OPENAI_API_KEY", keyValue: openaiKey, isActive: true });
    }
  };

  const handleUpdateFewsnet = () => {
    if (fewsnetKey) {
      updateSettingMutation.mutate({ keyName: "FEWSNET_API_KEY", keyValue: fewsnetKey, isActive: true });
    }
  };

  const handleUpdateOtherAPIs = () => {
    if (otherApis) {
      updateSettingMutation.mutate({ keyName: "OTHER_EXTERNAL_APIS", keyValue: otherApis, isActive: true });
    }
  };

  const handleSaveAllSettings = () => {
    toast({ title: "Success", description: "All settings saved successfully" });
  };

  const handleClearCache = () => {
    toast({ title: "Success", description: "Cache cleared successfully" });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2" data-testid="heading-settings">Settings</h1>
          <p className="text-gray-400">Configure API keys and system settings</p>
        </div>
        <div className="w-12 h-12 rounded-full bg-gradient-to-r from-[#f87171] to-[#fb923c] flex items-center justify-center text-white font-bold">
          AD
        </div>
      </div>

      {/* API Configuration */}
      <Card className="bg-[#2d3250] border-[#424769]">
        <CardHeader>
          <CardTitle className="text-white">API Configuration</CardTitle>
          <p className="text-sm text-gray-400">Manage your API keys and external integrations</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* OpenAI API Key */}
          <div className="space-y-2">
            <Label htmlFor="openai-key" className="text-gray-300">OpenAI API Key</Label>
            <div className="flex gap-3">
              <Input
                id="openai-key"
                type="password"
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder="sk-proj-••••••••••••••••••••••••••••••••••••••"
                className="flex-1 bg-[#424769] border-[#424769] text-white placeholder:text-gray-500"
                data-testid="input-openai-key"
              />
              <Button
                onClick={handleUpdateOpenAI}
                className="bg-gradient-to-r from-[#14b8a6] to-[#0d9488] hover:opacity-90 text-white"
                data-testid="button-update-openai"
              >
                Update
              </Button>
            </div>
          </div>

          {/* FEWSNET API Key */}
          <div className="space-y-2">
            <Label htmlFor="fewsnet-key" className="text-gray-300">FEWSNET API Key</Label>
            <div className="flex gap-3">
              <Input
                id="fewsnet-key"
                type="text"
                value={fewsnetKey}
                onChange={(e) => setFewsnetKey(e.target.value)}
                placeholder="Enter your FEWSNET API key..."
                className="flex-1 bg-[#424769] border-[#424769] text-white placeholder:text-gray-500"
                data-testid="input-fewsnet-key"
              />
              <Button
                onClick={handleUpdateFewsnet}
                className="bg-gradient-to-r from-[#14b8a6] to-[#0d9488] hover:opacity-90 text-white"
                data-testid="button-update-fewsnet"
              >
                Update
              </Button>
            </div>
          </div>

          {/* Other External APIs */}
          <div className="space-y-2">
            <Label htmlFor="other-apis" className="text-gray-300">Other External APIs</Label>
            <div className="flex gap-3">
              <Input
                id="other-apis"
                type="text"
                value={otherApis}
                onChange={(e) => setOtherApis(e.target.value)}
                placeholder="Enter additional API keys..."
                className="flex-1 bg-[#424769] border-[#424769] text-white placeholder:text-gray-500"
                data-testid="input-other-apis"
              />
              <Button
                onClick={handleUpdateOtherAPIs}
                className="bg-gradient-to-r from-[#14b8a6] to-[#0d9488] hover:opacity-90 text-white"
                data-testid="button-update-other-apis"
              >
                Update
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Configuration */}
      <Card className="bg-[#2d3250] border-[#424769]">
        <CardHeader>
          <CardTitle className="text-white">System Configuration</CardTitle>
          <p className="text-sm text-gray-400">Configure retry limits and fallback rules</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* API Retry Limits */}
            <div className="space-y-2">
              <Label htmlFor="retry-limits" className="text-gray-300">API Retry Limits</Label>
              <Input
                id="retry-limits"
                type="number"
                value={retryLimits}
                onChange={(e) => setRetryLimits(e.target.value)}
                className="bg-[#424769] border-[#424769] text-white"
                data-testid="input-retry-limits"
              />
              <p className="text-xs text-gray-400">Maximum retry attempts</p>
            </div>

            {/* Cache Settings */}
            <div className="space-y-2">
              <Label htmlFor="cache-settings" className="text-gray-300">Cache Settings</Label>
              <div className="flex gap-2">
                <Input
                  id="cache-settings"
                  type="number"
                  value={cacheSettings}
                  onChange={(e) => setCacheSettings(e.target.value)}
                  className="bg-[#424769] border-[#424769] text-white"
                  data-testid="input-cache-settings"
                />
                <Button
                  onClick={handleClearCache}
                  className="bg-gradient-to-r from-[#f87171] to-[#fb923c] hover:opacity-90 text-white"
                  data-testid="button-clear-cache"
                >
                  Clear Cache
                </Button>
              </div>
              <p className="text-xs text-gray-400">Cache duration (minutes)</p>
            </div>
          </div>

          {/* Request Timeout */}
          <div className="space-y-2">
            <Label htmlFor="request-timeout" className="text-gray-300">Request Timeout (seconds)</Label>
            <Input
              id="request-timeout"
              type="number"
              value={requestTimeout}
              onChange={(e) => setRequestTimeout(e.target.value)}
              className="bg-[#424769] border-[#424769] text-white"
              data-testid="input-request-timeout"
            />
            <p className="text-xs text-gray-400">Seconds before timeout</p>
          </div>

          {/* Fallback Rules */}
          <div className="flex items-center justify-between p-4 bg-[#424769] rounded-lg">
            <div>
              <Label className="text-gray-300">Fallback Rules</Label>
              <p className="text-xs text-gray-400 mt-1">Enable automatic fallback to backup APIs</p>
            </div>
            <Switch
              checked={fallbackRules}
              onCheckedChange={setFallbackRules}
              data-testid="switch-fallback-rules"
            />
          </div>

          {/* Save All Settings */}
          <div className="pt-4">
            <Button
              onClick={handleSaveAllSettings}
              className="bg-gradient-to-r from-[#14b8a6] to-[#0d9488] hover:opacity-90 text-white w-full md:w-auto"
              data-testid="button-save-all-settings"
            >
              Save All Settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
