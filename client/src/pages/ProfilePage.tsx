import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function ProfilePage() {
  const { toast } = useToast();
  const { data: profile } = useQuery({ queryKey: ["/api/user/profile"] });
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");

  const updateMutation = useMutation({
    mutationFn: async (updates: any) => {
      return apiRequest("/api/user/profile", {
        method: "PUT",
        body: JSON.stringify(updates),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/profile"] });
      toast({ title: "Success", description: "Profile updated successfully" });
      setFullName("");
      setPassword("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updates: any = {};
    if (fullName) updates.fullName = fullName;
    if (password) updates.password = password;
    if (Object.keys(updates).length > 0) {
      updateMutation.mutate(updates);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="heading-profile">My Profile</h1>
        <p className="text-muted-foreground">Manage your account settings</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Email</Label>
            <p className="text-sm text-muted-foreground" data-testid="text-email">{profile?.email}</p>
          </div>
          <div>
            <Label>Full Name</Label>
            <p className="text-sm text-muted-foreground" data-testid="text-fullname">{profile?.fullName}</p>
          </div>
          <div>
            <Label>Member Since</Label>
            <p className="text-sm text-muted-foreground">
              {profile?.createdAt && new Date(profile.createdAt).toLocaleDateString()}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Update Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName" data-testid="label-fullname">New Full Name</Label>
              <Input
                id="fullName"
                data-testid="input-fullname"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Leave empty to keep current"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" data-testid="label-password">New Password</Label>
              <Input
                id="password"
                data-testid="input-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave empty to keep current"
              />
            </div>
            <Button type="submit" disabled={updateMutation.isPending} data-testid="button-update">
              {updateMutation.isPending ? "Updating..." : "Update Profile"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
