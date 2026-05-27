import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import type { User } from "@shared/schema";

export default function ProfilePage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { data: profile } = useQuery<User>({ queryKey: ["/api/user/profile"] });
  
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [organization, setOrganization] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  const updateMutation = useMutation({
    mutationFn: async (updates: any) => {
      return apiRequest("/api/user/profile", {
        method: "PUT",
        body: JSON.stringify(updates),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/profile"] });
      toast({ 
        title: "✓ Profile updated successfully!",
        className: "bg-emerald-500 text-white border-0"
      });
      setFullName("");
      setPhone("");
      setOrganization("");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handlePersonalInfoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updates: any = {};
    if (fullName) updates.fullName = fullName;
    if (Object.keys(updates).length > 0) {
      updateMutation.mutate(updates);
    }
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match", variant: "destructive" });
      return;
    }
    if (newPassword) {
      updateMutation.mutate({ password: newPassword });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setLocation("/");
  };

  return (
    <div className="max-w-6xl mx-auto pb-20 md:pb-0">
      <Card className="bg-[#2a3749] border-[#3a4759] p-4 md:p-8 mb-4 md:mb-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-4 md:gap-6 text-center sm:text-left">
            <div className="w-16 h-16 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-xl md:text-3xl">
                {profile?.email?.[0]?.toUpperCase() || "J"}D
              </span>
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-white">{profile?.fullName || "John Doe"}</h2>
              <p className="text-sm md:text-base text-gray-400">{profile?.email || "john.doe@agritech.com"}</p>
              <p className="text-xs md:text-sm text-gray-500">
                Member since {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : "March 2024"}
              </p>
            </div>
          </div>
          <Button 
            onClick={handleLogout}
            className="bg-red-500 hover:bg-red-600 text-white text-sm"
            data-testid="button-logout"
          >
            Logout
          </Button>
        </div>
      </Card>

      <div className="space-y-4 md:space-y-6">
        <h1 className="text-xl md:text-2xl font-bold text-white" data-testid="heading-profile">Profile Settings</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          <Card className="bg-[#2a3749] border-[#3a4759] p-4 md:p-6">
            <h3 className="text-lg md:text-xl font-semibold text-white mb-4 md:mb-6">Personal Information</h3>
            
            <form onSubmit={handlePersonalInfoSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Full Name</Label>
                <div className="flex gap-2">
                  <Input
                    value={fullName || profile?.fullName || ""}
                    onChange={(e) => setFullName(e.target.value)}
                    className="bg-[#1a2332] border-[#3a4759] text-white"
                    placeholder="John Doe"
                    data-testid="input-fullname"
                  />
                  <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600" data-testid="button-update-name">
                    ✓
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-300">Email Address</Label>
                <div className="flex gap-2">
                  <Input
                    value={profile?.email || ""}
                    readOnly
                    className="bg-[#1a2332] border-[#3a4759] text-white"
                    data-testid="text-email"
                  />
                  <Button size="sm" className="bg-yellow-500 hover:bg-yellow-600" data-testid="button-edit-email">
                    ✏️
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-300">Phone Number</Label>
                <div className="flex gap-2">
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="bg-[#1a2332] border-[#3a4759] text-white"
                    placeholder="+91 98765 43210"
                    data-testid="input-phone"
                  />
                  <Button size="sm" className="bg-yellow-500 hover:bg-yellow-600" data-testid="button-edit-phone">
                    ✏️
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-300">Organization</Label>
                <div className="flex gap-2">
                  <Input
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    className="bg-[#1a2332] border-[#3a4759] text-white"
                    placeholder="AgriTech Solutions Pvt Ltd"
                    data-testid="input-organization"
                  />
                  <Button size="sm" className="bg-yellow-500 hover:bg-yellow-600" data-testid="button-edit-org">
                    ✏️
                  </Button>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button 
                  type="submit"
                  className="bg-emerald-500 hover:bg-emerald-600 text-white"
                  disabled={updateMutation.isPending}
                  data-testid="button-save-changes"
                >
                  Save Changes
                </Button>
                <Button 
                  type="button"
                  variant="outline"
                  className="bg-transparent border-gray-600 text-gray-400 hover:bg-[#1a2332]"
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Card>

          <Card className="bg-[#2a3749] border-[#3a4759] p-4 md:p-6">
            <h3 className="text-lg md:text-xl font-semibold text-white mb-4 md:mb-6">Security Settings</h3>
            
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Current Password</Label>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="bg-[#1a2332] border-[#3a4759] text-white"
                    placeholder="••••••••••••"
                    data-testid="input-current-password"
                  />
                  <Button size="sm" className="bg-red-500 hover:bg-red-600" data-testid="button-change-password">
                    CHANGE
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-300">New Password</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="bg-[#1a2332] border-[#3a4759] text-white"
                  placeholder="Enter new password"
                  data-testid="input-new-password"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-gray-300">Confirm New Password</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-[#1a2332] border-[#3a4759] text-white"
                  placeholder="Confirm new password"
                  data-testid="input-confirm-password"
                />
              </div>

              <div className="space-y-2 pt-4">
                <Label className="text-gray-300">Two-Factor Authentication</Label>
                <div className="flex items-center justify-between bg-[#1a2332] border border-[#3a4759] rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                    <span className="text-white">Enabled</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={twoFactorEnabled}
                      onCheckedChange={setTwoFactorEnabled}
                      className="data-[state=checked]:bg-emerald-500"
                      data-testid="switch-2fa"
                    />
                    <Button size="sm" className="bg-yellow-500 hover:bg-yellow-600" data-testid="button-setup-2fa">
                      SETUP
                    </Button>
                  </div>
                </div>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
