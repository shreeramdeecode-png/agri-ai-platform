import { CheckIcon } from "lucide-react";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const features = [
  "Natural Language Search",
  "Real-time Market Data",
  "Climate Intelligence",
];

export const LoginPageUi = (): JSX.Element => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="relative flex items-center justify-center min-h-screen w-full overflow-hidden bg-[#0a1628]">
      <div className="absolute w-32 h-32 bg-teal-600/20 rounded-full blur-3xl top-10 left-20"></div>
      <div className="absolute w-24 h-24 bg-teal-600/20 rounded-full blur-3xl top-32 right-40"></div>
      <div className="absolute w-40 h-40 bg-teal-600/20 rounded-full blur-3xl bottom-20 left-32"></div>
      <div className="absolute w-28 h-28 bg-teal-600/20 rounded-full blur-3xl bottom-40 right-20"></div>
      <div className="absolute w-20 h-20 bg-teal-600/30 rounded-full blur-2xl top-1/2 left-10"></div>
      <div className="absolute w-16 h-16 bg-teal-600/30 rounded-full blur-2xl bottom-32 right-1/3"></div>

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
              <p className="text-slate-300 text-base">
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

        <Card className="w-full max-w-md bg-white border-gray-200">
          <CardHeader className="text-center pb-6">
            <CardTitle className="text-3xl font-bold text-slate-800">
              Welcome Back
            </CardTitle>
            <CardDescription className="text-base text-slate-500">
              Sign in to your account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm text-slate-500">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                defaultValue="user@example.com"
                className="h-12 text-base text-slate-800 border-gray-300"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm text-slate-500">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  defaultValue="••••••••"
                  className="h-12 text-base text-slate-800 border-gray-300 pr-16"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-emerald-600 font-normal hover:text-emerald-700"
                >
                  Show
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="remember"
                  className="border-gray-300 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                />
                <Label
                  htmlFor="remember"
                  className="text-sm text-slate-500 font-normal cursor-pointer"
                >
                  Remember me
                </Label>
              </div>
              <button className="text-sm text-emerald-600 font-normal hover:text-emerald-700">
                Forgot password?
              </button>
            </div>

            <Button className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white text-base font-bold">
              Sign In
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-slate-500">or</span>
              </div>
            </div>

            <p className="text-center text-sm text-slate-500">
              Don't have an account?{" "}
              <button className="font-bold text-emerald-600 hover:text-emerald-700">
                Sign up
              </button>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
