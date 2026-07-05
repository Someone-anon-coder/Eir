import { Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "./pages/LoginPage";
import { DashboardLayout } from "./pages/DashboardLayout";
import { DevicesPage } from "./pages/DevicesPage";
import { ProvisioningPage } from "./pages/ProvisioningPage";
import { AccountPage } from "./pages/AccountPage";
import { RequestWizardPage } from "./pages/RequestWizardPage";
import { ProtectedRoute } from "./components/ProtectedRoute";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="devices" replace />} />
        <Route path="devices" element={<DevicesPage />} />
        <Route path="provisioning" element={<ProvisioningPage />} />
        <Route path="account" element={<AccountPage />} />
        <Route path="requests/new" element={<RequestWizardPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
