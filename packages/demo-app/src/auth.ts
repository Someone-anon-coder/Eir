const AUTH_KEY = "ward_auth";

export function isAuthenticated(): boolean {
  return sessionStorage.getItem(AUTH_KEY) === "1";
}

export function signIn(): void {
  sessionStorage.setItem(AUTH_KEY, "1");
}

export function signOut(): void {
  sessionStorage.removeItem(AUTH_KEY);
}
