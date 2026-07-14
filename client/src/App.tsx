import { Router, Route } from "wouter";
import { Suspense, lazy } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Toaster } from "@/components/ui/toaster";

const DashboardPage = lazy(() => import("@/pages/dashboard-page"));
const RepositoryPage = lazy(() => import("@/pages/repository-page"));
const SettingsPage = lazy(() => import("@/pages/settings-page"));
const ProfilePage = lazy(() => import("@/pages/profile-page"));
const LoginPage = lazy(() => import("@/pages/login-page"));
const RegisterPage = lazy(() => import("@/pages/register-page"));
const NotFoundPage = lazy(() => import("@/pages/not-found-page"));

function ProtectedRoute({
  component: Component,
}: {
  component: React.ComponentType;
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!user) {
    window.location.href = "/login";
    return null;
  }

  return <Component />;
}

export default function App() {
  return (
    <Router>
      <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
        <Route path="/login" component={LoginPage} />
        <Route path="/register" component={RegisterPage} />
        <Route path="/dashboard" component={() => <ProtectedRoute component={DashboardPage} />} />
        <Route path="/repositories/:id" component={() => <ProtectedRoute component={RepositoryPage} />} />
        <Route path="/settings" component={() => <ProtectedRoute component={SettingsPage} />} />
        <Route path="/profile" component={() => <ProtectedRoute component={ProfilePage} />} />
        <Route path="/" component={() => <ProtectedRoute component={DashboardPage} />} />
        <Route component={NotFoundPage} />
      </Suspense>
      <Toaster />
    </Router>
  );
}
