import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { domProfile } from "../domProfile";
import { signOut } from "../auth";
import { isWrapped, overrideTag, overrideText } from "../mutation/overrides";

interface NavItemProps {
  mutationKey: string;
  to: string;
  testId: string;
  label: string;
}

// tag-swap's real target: a NavLink renders as `<a>` (role "link"); forcing
// it to a `<button>` (role "button") is what breaks a `getByRole("link", …)`
// selector without touching its testid at all.
function NavItem({ mutationKey, to, testId, label }: NavItemProps) {
  const navigate = useNavigate();
  const text = overrideText(`${mutationKey}.text`, label);
  const tag = overrideTag(`${mutationKey}.tag`, "a");
  if (tag === "button") {
    return (
      <button type="button" data-testid={testId} onClick={() => navigate(to)}>
        {text}
      </button>
    );
  }
  return (
    <NavLink to={to} data-testid={testId}>
      {text}
    </NavLink>
  );
}

export function DashboardLayout() {
  const navigate = useNavigate();

  function handleLogout() {
    signOut();
    navigate("/login", { replace: true });
  }

  const logoutText = overrideText("nav.logoutButton.text", "Log Out");
  const logoutTag = overrideTag("nav.logoutButton.tag", "button");
  const logoutButton =
    logoutTag === "a" ? (
      <a href="#logout" data-testid={domProfile.nav.logoutButton} onClick={handleLogout}>
        {logoutText}
      </a>
    ) : (
      <button type="button" data-testid={domProfile.nav.logoutButton} onClick={handleLogout}>
        {logoutText}
      </button>
    );

  // wrapper-inject's real target: Ward's committed ancestor-XPath selectors
  // walk `ancestor::section`, which is depth-agnostic by design (see
  // packages/benchmark/src/targets.ts) — so a fragile *exact*-depth probe
  // (`parent::nav`) is what actually demonstrates this class here.
  const wrapNav = isWrapped("nav.root");
  const navChildren = (
    <>
      <span className="brand">Ward</span>
      <NavItem
        mutationKey="nav.devicesLink"
        to="/dashboard/devices"
        testId={domProfile.nav.devicesLink}
        label="Devices"
      />
      <NavItem
        mutationKey="nav.provisioningLink"
        to="/dashboard/provisioning"
        testId={domProfile.nav.provisioningLink}
        label="Provisioning"
      />
      <NavItem
        mutationKey="nav.accountLink"
        to="/dashboard/account"
        testId={domProfile.nav.accountLink}
        label="Account"
      />
      <NavItem
        mutationKey="nav.requestsLink"
        to="/dashboard/requests/new"
        testId={domProfile.nav.requestsLink}
        label="Access Requests"
      />
      {logoutButton}
    </>
  );

  return (
    <div className="dashboard-layout">
      <nav data-testid={domProfile.nav.root}>{wrapNav ? <div>{navChildren}</div> : navChildren}</nav>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
