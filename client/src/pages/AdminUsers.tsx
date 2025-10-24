import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, Edit, Trash2, Search, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { z } from "zod";

const addUserSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
  role: z.string().default("user"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export default function AdminUsers() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);

  const { data: users, isLoading } = useQuery({ queryKey: ["/api/admin/users"] });

  const form = useForm({
    resolver: zodResolver(addUserSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      role: "user",
    },
  });

  const addUserMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("/api/admin/users", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Success", description: "User added successfully" });
      setIsAddUserOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to add user", variant: "destructive" });
    },
  });

  const toggleUserMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return apiRequest(`/api/admin/users/${id}`, {
        method: "PUT",
        body: JSON.stringify({ isActive }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Success", description: "User status updated" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/admin/users/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Success", description: "User deleted" });
    },
  });

  if (isLoading) return <div className="p-8 text-white">Loading users...</div>;

  const allUsers = users || [];
  const filteredUsers = allUsers.filter((user: any) => {
    const matchesSearch = user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === "all" || 
                         (filter === "active" && user.isActive) ||
                         (filter === "inactive" && !user.isActive);
    return matchesSearch && matchesFilter;
  });

  const getAvatarColor = (index: number) => {
    const colors = ["bg-cyan-500", "bg-pink-500", "bg-yellow-500", "bg-purple-500", "bg-red-500"];
    return colors[index % colors.length];
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const onSubmit = (data: any) => {
    const { confirmPassword, ...userData } = data;
    addUserMutation.mutate(userData);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2" data-testid="heading-users">User Management</h1>
          <p className="text-gray-400">Manage registered users and their permissions</p>
        </div>
        <div className="w-12 h-12 rounded-full bg-gradient-to-r from-[#f87171] to-[#fb923c] flex items-center justify-center text-white font-bold">
          AD
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search users by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-[#2d3250] border-[#424769] text-white placeholder:text-gray-500"
            data-testid="input-search-users"
          />
        </div>
        <Button
          onClick={() => setIsAddUserOpen(true)}
          className="bg-gradient-to-r from-[#14b8a6] to-[#0d9488] hover:opacity-90 text-white"
          data-testid="button-add-user"
        >
          <UserPlus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        <Button
          variant={filter === "all" ? "default" : "outline"}
          onClick={() => setFilter("all")}
          className={filter === "all" ? "bg-gradient-to-r from-[#f87171] to-[#fb923c] text-white border-0" : "bg-transparent border-[#424769] text-gray-300"}
          data-testid="filter-all-users"
        >
          All Users
        </Button>
        <Button
          variant={filter === "active" ? "default" : "outline"}
          onClick={() => setFilter("active")}
          className={filter === "active" ? "bg-[#424769] text-white border-[#424769]" : "bg-transparent border-[#424769] text-gray-300"}
          data-testid="filter-active"
        >
          Active
        </Button>
        <Button
          variant={filter === "inactive" ? "default" : "outline"}
          onClick={() => setFilter("inactive")}
          className={filter === "inactive" ? "bg-[#424769] text-white border-[#424769]" : "bg-transparent border-[#424769] text-gray-300"}
          data-testid="filter-inactive"
        >
          Inactive
        </Button>
      </div>

      {/* Users Table */}
      <Card className="bg-[#2d3250] border-[#424769]">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#424769]">
                <tr>
                  <th className="text-left p-4 text-gray-300 font-medium">User</th>
                  <th className="text-left p-4 text-gray-300 font-medium">Email</th>
                  <th className="text-left p-4 text-gray-300 font-medium">Status</th>
                  <th className="text-left p-4 text-gray-300 font-medium">Last Login</th>
                  <th className="text-center p-4 text-gray-300 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user: any, index: number) => (
                  <tr
                    key={user.id}
                    className="border-t border-[#424769] hover:bg-[#424769]/50 transition-colors"
                    data-testid={`user-row-${user.id}`}
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full ${getAvatarColor(index)} flex items-center justify-center text-white font-bold`}>
                          {getInitials(user.fullName)}
                        </div>
                        <div>
                          <p className="text-white font-medium">{user.fullName}</p>
                          <p className="text-xs text-gray-400">{user.role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="text-gray-300" data-testid={`text-user-email-${user.id}`}>{user.email}</p>
                    </td>
                    <td className="p-4">
                      <Badge
                        variant={user.isActive ? "default" : "secondary"}
                        className={user.isActive ? "bg-emerald-500 text-white" : "bg-gray-500 text-white"}
                        data-testid={`badge-status-${user.id}`}
                      >
                        {user.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <p className="text-gray-400 text-sm">
                        {user.createdAt ? new Date(user.createdAt).toLocaleString() : "Never"}
                      </p>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          size="sm"
                          className="bg-cyan-500 hover:bg-cyan-600 text-white w-8 h-8 p-0"
                          data-testid={`button-view-${user.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          className="bg-yellow-500 hover:bg-yellow-600 text-white w-8 h-8 p-0"
                          onClick={() => toggleUserMutation.mutate({ id: user.id, isActive: !user.isActive })}
                          data-testid={`button-edit-${user.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {user.role !== "admin" && (
                          <Button
                            size="sm"
                            className="bg-red-500 hover:bg-red-600 text-white w-8 h-8 p-0"
                            onClick={() => {
                              if (confirm("Are you sure you want to delete this user?")) {
                                deleteUserMutation.mutate(user.id);
                              }
                            }}
                            data-testid={`button-delete-${user.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t border-[#424769] text-sm text-gray-400">
            Showing 1-{filteredUsers.length} of {allUsers.length} users
          </div>
        </CardContent>
      </Card>

      {/* Add User Modal */}
      <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
        <DialogContent className="bg-[#424769] border-[#2d3250] text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Add New User</DialogTitle>
            <p className="text-sm text-gray-400">Create a new user account with permissions</p>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-300">Full Name *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Enter user's full name"
                        className="bg-[#2d3250] border-[#2d3250] text-white placeholder:text-gray-500"
                        data-testid="input-fullname"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-300">Email Address *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        placeholder="Enter email address"
                        className="bg-[#2d3250] border-[#2d3250] text-white placeholder:text-gray-500"
                        data-testid="input-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-300">Password *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder="Enter secure password"
                        className="bg-[#2d3250] border-[#2d3250] text-white placeholder:text-gray-500"
                        data-testid="input-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-300">Confirm Password *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder="Confirm password"
                        className="bg-[#2d3250] border-[#2d3250] text-white placeholder:text-gray-500"
                        data-testid="input-confirm-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddUserOpen(false)}
                  className="flex-1 bg-transparent border-[#2d3250] text-gray-300"
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-[#14b8a6] to-[#0d9488] hover:opacity-90 text-white"
                  disabled={addUserMutation.isPending}
                  data-testid="button-submit-add-user"
                >
                  {addUserMutation.isPending ? "Adding..." : "Add User"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
