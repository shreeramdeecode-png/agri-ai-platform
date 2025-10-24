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

export default function SignupPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const signupMutation = useMutation({
    mutationFn: async (data: any) => {
      const result = await apiRequest("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify(data),
      });
      return result;
    },
    onSuccess: (data: any) => {
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      toast({
        title: "Success",
        description: "Account created successfully",
      });
      setLocation("/search");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Signup failed",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    signupMutation.mutate({
      fullName: `${firstName} ${lastName}`,
      email,
      password,
      role: "user",
      isActive: true,
    });
  };

  return (
    <div className="relative flex items-center justify-center min-h-screen w-full overflow-hidden bg-[#0a1628]">
      {/* Decorative Background Circles */}
      <div className="absolute w-48 h-48 bg-teal-600/20 rounded-full blur-3xl top-10 left-20"></div>
      <div className="absolute w-32 h-32 bg-teal-600/15 rounded-full blur-3xl top-32 right-40"></div>
      <div className="absolute w-64 h-64 bg-teal-600/15 rounded-full blur-3xl bottom-20 right-32"></div>
      <div className="absolute w-40 h-40 bg-teal-600/20 rounded-full blur-3xl bottom-40 left-20"></div>
      <div className="absolute w-32 h-32 bg-teal-600/10 rounded-full blur-2xl top-1/2 left-1/2"></div>

      <div className="relative z-10 flex items-center justify-center gap-16 w-full max-w-7xl px-8">
        {/* Left Panel - Branding & Features */}
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

        {/* Right Panel - Signup Form */}
        <Card className="w-full max-w-md bg-white border-gray-200">
          <CardHeader className="text-center pb-6">
            <CardTitle className="text-3xl font-bold text-slate-800">
              Create Account
            </CardTitle>
            <CardDescription className="text-base text-slate-500">
              Join AgriSearch today
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-sm text-slate-700">
                    First Name
                  </Label>
                  <Input
                    id="firstName"
                    data-testid="input-firstname"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="John"
                    className="h-12 text-base"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-sm text-slate-700">
                    Last Name
                  </Label>
                  <Input
                    id="lastName"
                    data-testid="input-lastname"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                    className="h-12 text-base"
                    required
                  />
                </div>
              </div>

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

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm text-slate-700">
                  Confirm Password
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    data-testid="input-confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-12 text-base pr-16"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-teal-600 font-medium hover:text-teal-700"
                  >
                    {showConfirmPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white text-base font-bold"
                disabled={signupMutation.isPending}
                data-testid="button-submit"
              >
                {signupMutation.isPending ? "Creating account..." : "Sign Up"}
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
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setLocation("/")}
                className="font-bold text-teal-600 hover:text-teal-700"
                data-testid="button-signin"
              >
                Sign in
              </button>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
