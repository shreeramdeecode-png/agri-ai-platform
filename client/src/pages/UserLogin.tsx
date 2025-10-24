import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  const authMutation = useMutation({
    mutationFn: async (credentials: any) => {
      const endpoint = isSignup ? "/api/auth/signup" : "/api/auth/login";
      const result = await apiRequest(endpoint, {
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
        description: isSignup ? "Account created successfully" : "Logged in successfully",
      });
      setLocation("/search");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Authentication failed",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const credentials = isSignup
      ? { email, password, fullName, role: "user", isActive: true }
      : { email, password };
    authMutation.mutate(credentials);
  };

  return (
    <div className="relative flex items-center justify-center min-h-screen w-full overflow-hidden bg-[#0a1628]">
      <div className="absolute w-32 h-32 bg-teal-600/20 rounded-full blur-3xl top-10 left-20"></div>
      <div className="absolute w-24 h-24 bg-teal-600/20 rounded-full blur-3xl top-32 right-40"></div>
      <div className="absolute w-40 h-40 bg-teal-600/20 rounded-full blur-3xl bottom-20 left-32"></div>
      <div className="absolute w-28 h-28 bg-teal-600/20 rounded-full blur-3xl bottom-40 right-20"></div>

      <div className="relative z-10 flex items-center justify-center gap-16 w-full max-w-7xl px-8">
        <Card className="w-full max-w-md bg-gradient-to-br from-teal-900/40 to-teal-800/30 border-teal-700/50 backdrop-blur-sm">
          <CardContent className="pt-12 pb-12 px-12">
            <div className="flex flex-col items-center mb-8">
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-emerald-500/30 rounded-full blur-2xl"></div>
                <div className="relative w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center">
                  <div className="w-10 h-10 bg-white rounded-full"></div>
                </div>
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">AgriSearch</h1>
              <p className="text-slate-300 text-base">AI-Powered Agricultural Intelligence</p>
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

        <Card className="w-full max-w-md bg-white border-gray-200">
          <CardHeader className="text-center pb-6">
            <CardTitle className="text-3xl font-bold text-slate-800">
              {isSignup ? "Create Account" : "Welcome Back"}
            </CardTitle>
            <CardDescription className="text-base text-slate-500">
              {isSignup ? "Sign up to get started" : "Sign in to your account"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignup && (
                <div className="space-y-2">
                  <Label htmlFor="fullName" data-testid="label-fullname">Full Name</Label>
                  <Input
                    id="fullName"
                    data-testid="input-fullname"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required={isSignup}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email" data-testid="label-email">Email Address</Label>
                <Input
                  id="email"
                  data-testid="input-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" data-testid="label-password">Password</Label>
                <Input
                  id="password"
                  data-testid="input-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                disabled={authMutation.isPending}
                data-testid="button-submit"
              >
                {authMutation.isPending ? "Processing..." : isSignup ? "Sign Up" : "Sign In"}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <button
                onClick={() => setIsSignup(!isSignup)}
                className="text-sm text-emerald-600 hover:text-emerald-700"
                data-testid="button-toggle-mode"
              >
                {isSignup ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
