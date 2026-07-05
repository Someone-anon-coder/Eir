import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { domProfile } from "../domProfile";
import { signOut } from "../auth";

export function DashboardLayout() {
  const navigate = useNavigate();

  function handleLogout() {
    signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="dashboard-layout">
      <nav data-testid={domProfile.nav.root}>
        <span className="brand">Ward</span>
        <NavLink to="/dashboard/devices" data-testid={domProfile.nav.devicesLink}>
          Devices
        </NavLink>
        <NavLink to="/dashboard/provisioning" data-testid={domProfile.nav.provisioningLink}>
          Provisioning
        </NavLink>
        <NavLink to="/dashboard/account" data-testid={domProfile.nav.accountLink}>
          Account
        </NavLink>
        <NavLink to="/dashboard/requests/new" data-testid={domProfile.nav.requestsLink}>
          Access Requests
        </NavLink>
        <button type="button" data-testid={domProfile.nav.logoutButton} onClick={handleLogout}>
          Log Out
        </button>
      </nav>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
