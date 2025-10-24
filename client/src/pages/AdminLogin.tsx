import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Shield, CheckIcon } from "lucide-react";

const adminFeatures = [
  "User Management",
  "Content Moderation",
  "System Analytics",
];

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const loginMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const result = await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(credentials),
      });
      return result;
    },
    onSuccess: (data: any) => {
      if (data.user.role !== "admin") {
        toast({
          title: "Access Denied",
          description: "Admin access required",
          variant: "destructive",
        });
        return;
      }
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      toast({
        title: "Success",
        description: "Logged in successfully",
      });
      setLocation("/admin/dashboard");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Login failed",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ email, password });
  };

  return (
    <div className="relative flex items-center justify-center min-h-screen w-full overflow-hidden bg-[#0a1628]">
      <div className="absolute w-32 h-32 bg-blue-600/20 rounded-full blur-3xl top-10 left-20"></div>
      <div className="absolute w-24 h-24 bg-blue-600/20 rounded-full blur-3xl top-32 right-40"></div>
      <div className="absolute w-40 h-40 bg-blue-600/20 rounded-full blur-3xl bottom-20 left-32"></div>
      <div className="absolute w-28 h-28 bg-blue-600/20 rounded-full blur-3xl bottom-40 right-20"></div>

      <div className="relative z-10 flex items-center justify-center gap-16 w-full max-w-7xl px-8">
        <Card className="w-full max-w-md bg-gradient-to-br from-blue-900/40 to-blue-800/30 border-blue-700/50 backdrop-blur-sm">
          <CardContent className="pt-12 pb-12 px-12">
            <div className="flex flex-col items-center mb-8">
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-blue-500/30 rounded-full blur-2xl"></div>
                <div className="relative w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center">
                  <Shield className="w-10 h-10 text-white" />
                </div>
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">Admin Portal</h1>
              <p className="text-slate-300 text-base">AgriSearch Management</p>
            </div>

            <div className="space-y-4">
              {adminFeatures.map((feature, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                    <CheckIcon className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-slate-200 text-sm">{feature}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="w-full max-w-md bg-white border-gray-200">
          <CardHeader className="text-center pb-6">
            <CardTitle className="text-3xl font-bold text-slate-800">
              Admin Sign In
            </CardTitle>
            <CardDescription className="text-base text-slate-500">
              Access the admin dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs font-semibold text-blue-800 mb-1">Admin Test Account</p>
              <p className="text-xs text-blue-700">Email: admin@agrisearch.com</p>
              <p className="text-xs text-blue-700">Password: admin123</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-email" className="text-sm text-slate-700">Email Address</Label>
                <Input
                  id="admin-email"
                  data-testid="input-admin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 text-base"
                  placeholder="admin@agrisearch.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-password" className="text-sm text-slate-700">Password</Label>
                <Input
                  id="admin-password"
                  data-testid="input-admin-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 text-base"
                  placeholder="Enter your password"
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white text-base font-bold"
                disabled={loginMutation.isPending}
                data-testid="button-admin-login"
              >
                {loginMutation.isPending ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
