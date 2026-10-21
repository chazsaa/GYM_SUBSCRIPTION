import React, { createContext, useContext, useState } from 'react';

// ---------------------------------------------------------------------------
// DEMO AUTHENTICATION (for the school activity only)
// There is no server. Accounts live in memory while the app is open, and the
// login state resets when the app is fully closed. A real app would check the
// credentials on a server and never keep passwords in the app.
// ---------------------------------------------------------------------------
const DEMO_ACCOUNTS = [
  { name: 'Demo Member', email: 'demo@gym.com', password: 'gym12345' },
];

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  // user is null when logged out, or { name, email } when logged in.
  // We never store the password in this state.
  const [user, setUser] = useState(null);
  const [accounts, setAccounts] = useState(DEMO_ACCOUNTS);

  // Returns true when the email and password match an account.
  const login = (email, password) => {
    const cleanEmail = email.trim().toLowerCase();
    const match = accounts.find(
      (account) => account.email === cleanEmail && account.password === password
    );
    if (!match) return false;
    setUser({ name: match.name, email: match.email });
    return true;
  };

  // Adds a new demo account. Returns { ok: true } or { ok: false, message }.
  const register = (name, email, password) => {
    const cleanEmail = email.trim().toLowerCase();
    if (accounts.some((account) => account.email === cleanEmail)) {
      return { ok: false, message: 'An account with this email already exists.' };
    }
    setAccounts([...accounts, { name: name.trim(), email: cleanEmail, password }]);
    return { ok: true };
  };

  const logout = () => setUser(null);

  const value = { user, isLoggedIn: user !== null, login, register, logout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Any screen can call useAuth() to read the login state or log in/out.
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>.');
  }
  return context;
};
