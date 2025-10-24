import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import AdminLayout from "@/components/AdminLayout";
import UserLayout from "@/components/UserLayout";

import UserLogin from "@/pages/UserLogin";
import SignupPage from "@/pages/SignupPage";
import AdminLogin from "@/pages/AdminLogin";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminUsers from "@/pages/AdminUsers";
import AdminDocuments from "@/pages/AdminDocuments";
import AdminLogs from "@/pages/AdminLogs";
import AdminSettings from "@/pages/AdminSettings";
import AdminNotifications from "@/pages/AdminNotifications";
import SearchPage from "@/pages/SearchPage";
import SearchResults from "@/pages/SearchResults";
import DocumentsPage from "@/pages/DocumentsPage";
import ImagesPage from "@/pages/ImagesPage";
import HistoryPage from "@/pages/HistoryPage";
import ProfilePage from "@/pages/ProfilePage";

function ProtectedRoute({ component: Component, layout: Layout }: any) {
  const token = localStorage.getItem("token");
  
  if (!token) {
    return <Redirect to="/" />;
  }

  return Layout ? (
    <Layout>
      <Component />
    </Layout>
  ) : (
    <Component />
  );
}

function AdminProtectedRoute({ component: Component }: any) {
  const token = localStorage.getItem("token");
  const user = localStorage.getItem("user");
  
  if (!token) {
    return <Redirect to="/admin" />;
  }

  if (user) {
    const userData = JSON.parse(user);
    if (userData.role !== "admin") {
      return <Redirect to="/" />;
    }
  }

  return (
    <AdminLayout>
      <Component />
    </AdminLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={UserLogin} />
      <Route path="/signup" component={SignupPage} />
      <Route path="/admin" component={AdminLogin} />
      
      <Route path="/admin/dashboard">
        {() => <AdminProtectedRoute component={AdminDashboard} />}
      </Route>
      <Route path="/admin/users">
        {() => <AdminProtectedRoute component={AdminUsers} />}
      </Route>
      <Route path="/admin/documents">
        {() => <AdminProtectedRoute component={AdminDocuments} />}
      </Route>
      <Route path="/admin/logs">
        {() => <AdminProtectedRoute component={AdminLogs} />}
      </Route>
      <Route path="/admin/notifications">
        {() => <AdminProtectedRoute component={AdminNotifications} />}
      </Route>
      <Route path="/admin/settings">
        {() => <AdminProtectedRoute component={AdminSettings} />}
      </Route>

      <Route path="/search">
        {() => <ProtectedRoute component={SearchPage} layout={UserLayout} />}
      </Route>
      <Route path="/search/results">
        {() => <ProtectedRoute component={SearchResults} layout={UserLayout} />}
      </Route>
      <Route path="/documents">
        {() => <ProtectedRoute component={DocumentsPage} layout={UserLayout} />}
      </Route>
      <Route path="/images">
        {() => <ProtectedRoute component={ImagesPage} layout={UserLayout} />}
      </Route>
      <Route path="/history">
        {() => <ProtectedRoute component={HistoryPage} layout={UserLayout} />}
      </Route>
      <Route path="/profile">
        {() => <ProtectedRoute component={ProfilePage} layout={UserLayout} />}
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
