import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { CheckIcon } from "lucide-react";

const features = [
  "Natural Language Search",
  "Real-time Market Data",
  "Climate Intelligence",
];

export default function UserLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const loginMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const result = await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(credentials),
      });
      return result;
    },
    onSuccess: (data: any) => {
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      toast({
        title: "Success",
        description: "Logged in successfully",
      });
      setLocation("/search");
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
    <div className="relative flex items-center justify-center min-h-[100dvh] min-h-screen w-full overflow-x-hidden overflow-y-auto bg-[#0a1628] py-8 px-4 sm:px-6">
      {/* Decorative Background Circles */}
      <div className="pointer-events-none absolute w-48 h-48 bg-teal-600/20 rounded-full blur-3xl top-10 left-20"></div>
      <div className="pointer-events-none absolute w-32 h-32 bg-teal-600/15 rounded-full blur-3xl top-32 right-40"></div>
      <div className="pointer-events-none absolute w-64 h-64 bg-teal-600/15 rounded-full blur-3xl bottom-20 right-32"></div>
      <div className="pointer-events-none absolute w-40 h-40 bg-teal-600/20 rounded-full blur-3xl bottom-40 left-20"></div>

      <div className="relative z-10 flex flex-col lg:flex-row items-stretch lg:items-center justify-center gap-6 lg:gap-16 w-full max-w-7xl mx-auto">
        {/* Left Panel - Branding & Features */}
        <Card className="w-full max-w-md mx-auto lg:mx-0 bg-gradient-to-br from-teal-900/40 to-teal-800/30 border-teal-700/50 backdrop-blur-sm shrink-0">
          <CardContent className="pt-8 pb-8 sm:pt-12 sm:pb-12 px-6 sm:px-12">
            <div className="flex flex-col items-center mb-8">
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-emerald-500/30 rounded-full blur-2xl"></div>
                <div className="relative w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center">
                  <div className="w-10 h-10 bg-white rounded-full"></div>
                </div>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">AgriSearch</h1>
              <p className="text-slate-300 text-base text-center">
                AI-Powered Agricultural Intelligence
              </p>
            </div>

            <div className="space-y-4">
              {features.map((feature, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                    <CheckIcon className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-slate-200 text-sm">{feature}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Right Panel - Login Form */}
        <Card className="w-full max-w-md mx-auto lg:mx-0 bg-white border-gray-200 shrink-0">
          <CardHeader className="text-center pb-4 sm:pb-6 px-4 sm:px-6 pt-6 sm:pt-8">
            <CardTitle className="text-2xl sm:text-3xl font-bold text-slate-800">
              Welcome Back
            </CardTitle>
            <CardDescription className="text-base text-slate-500">
              Sign in to your account
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-6 sm:pb-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm text-slate-700">
                  Email Address
                </Label>
                <Input
                  id="email"
                  data-testid="input-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="h-12 text-base"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm text-slate-700">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    data-testid="input-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-12 text-base pr-16"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-teal-600 font-medium hover:text-teal-700"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-0 sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="remember"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                    className="border-gray-300 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                  />
                  <Label
                    htmlFor="remember"
                    className="text-sm text-slate-500 font-normal cursor-pointer"
                  >
                    Remember me
                  </Label>
                </div>
                <button
                  type="button"
                  className="text-sm text-teal-600 font-medium hover:text-teal-700"
                >
                  Forgot password?
                </button>
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white text-base font-bold"
                disabled={loginMutation.isPending}
                data-testid="button-submit"
              >
                {loginMutation.isPending ? "Signing in..." : "Sign In"}
              </Button>
            </form>

            <div className="relative mt-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-slate-500">or</span>
              </div>
            </div>

            <p className="text-center text-sm text-slate-500 mt-4">
              Don't have an account?{" "}
              <button
                type="button"
                onClick={() => setLocation("/signup")}
                className="font-bold text-teal-600 hover:text-teal-700"
                data-testid="button-signup"
              >
                Sign up
              </button>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
