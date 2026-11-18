import { type SubmitEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { domProfile } from "../domProfile";
import { signIn } from "../auth";
import { isRegressed } from "../mutation/overrides";
import { gt } from "../mutation/gtMarkers";

export function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    // real-regression `login.acceptsEmptyPassword`: the password check is skipped.
    const passwordMissing = password.trim() === "" && !isRegressed("login.acceptsEmptyPassword");
    if (username.trim() === "" || passwordMissing) {
      setError("Username and password are required.");
      return;
    }
    signIn();
    navigate("/dashboard/devices", { replace: true });
  }

  return (
    <div className="login-page">
      <h1>Ward</h1>
      <form data-testid={domProfile.login.form} onSubmit={handleSubmit}>
        <label htmlFor={domProfile.login.usernameInputId}>Username</label>
        <input
          id={domProfile.login.usernameInputId}
          data-testid={domProfile.login.usernameInput}
          {...gt("login.usernameInput")}
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />
        <label htmlFor={domProfile.login.passwordInputId}>Password</label>
        <input
          id={domProfile.login.passwordInputId}
          type="password"
          data-testid={domProfile.login.passwordInput}
          {...gt("login.passwordInput")}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {error !== null && <p data-testid={domProfile.login.errorBanner}>{error}</p>}
        <button type="submit" data-testid={domProfile.login.submitButton}>
          Sign In
        </button>
      </form>
    </div>
  );
}
