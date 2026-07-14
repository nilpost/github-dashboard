import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";

export default function ProfilePage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST", credentials: "include" });
    setLocation("/login");
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-8">Profile</h1>

      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-xl font-bold mb-4">Account Information</h2>
        {user && (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600">Username</p>
              <p className="text-lg font-medium">{user.username}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Email</p>
              <p className="text-lg font-medium">{user.email}</p>
            </div>
            {user.firstName && (
              <div>
                <p className="text-sm text-gray-600">Name</p>
                <p className="text-lg font-medium">
                  {user.firstName} {user.lastName}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <button
        onClick={handleLogout}
        className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
      >
        Logout
      </button>
    </div>
  );
}
