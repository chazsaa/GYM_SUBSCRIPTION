import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

// ---------------------------------------------------------------------------
// Authentication with Supabase.
// Accounts live online, and the login is remembered on the phone until the
// user logs out.
// ---------------------------------------------------------------------------
const AuthContext = createContext(null);

// Turn Supabase's technical errors into messages a member can read.
const friendlyMessage = (error) => {
  const text = (error?.message || '').toLowerCase();
  if (text.includes('invalid login credentials')) {
    return 'Incorrect email or password. Please try again.';
  }
  if (text.includes('already registered') || error?.code === 'user_already_exists') {
    return 'An account with this email already exists.';
  }
  if (text.includes('fetch') || text.includes('network')) {
    return 'Could not connect. Check your internet and try again.';
  }
  if (text.includes('email not confirmed')) {
    return 'Please confirm your email first. Check your inbox for the link.';
  }
  if (text.includes('expired or is invalid') || text.includes('otp')) {
    return 'That code is wrong or has expired. Check it, or request a new code.';
  }
  if (text.includes('different from the old password')) {
    return 'Choose a password you have not used before.';
  }
  if (text.includes('session') && text.includes('missing')) {
    return 'This reset link has expired. Please request a new one.';
  }
  if (text.includes('rate limit') || text.includes('security purposes')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  return 'Something went wrong. Please try again.';
};

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true); // true while the saved login is being restored
  // While true, login-state changes are ignored (used during registration and
  // password reset, so the member is NOT logged in automatically).
  const quiet = useRef(false);
  // Which dashboard this account gets. Stored together with the user it belongs
  // to, so a role is never carried over from a previous login.
  const [roleState, setRoleState] = useState({ userId: null, isAdmin: false });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    // Keep this callback tiny: only store the session.
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (quiet.current) return;
      setSession(nextSession);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // Is this account a gym admin? Asked once per login. A person can only see
  // their own row in the admins table, so this reveals nothing about anyone else.
  // The database re-checks every admin action, so this only decides which
  // dashboard is shown.
  const userId = session?.user?.id ?? null;
  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    supabase
      .from('admins')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setRoleState({ userId, isAdmin: !!data });
      })
      .catch(() => {
        if (!cancelled) setRoleState({ userId, isAdmin: false });
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);
  const roleLoading = userId !== null && roleState.userId !== userId;
  const isAdmin = !roleLoading && userId !== null && roleState.isAdmin;

  // user is null when logged out, or { id, name, email } when logged in.
  const user = session
    ? {
        id: session.user.id,
        name: session.user.user_metadata?.full_name || '',
        email: session.user.email,
      }
    : null;

  // Returns { ok: true } or { ok: false, message }.
  const login = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) return { ok: false, message: friendlyMessage(error) };
    return { ok: true };
  };

  // Returns { ok: true } or { ok: false, message }.
  // The new member is NOT logged in: they are signed out again right away and
  // must log in themselves. needsConfirmation is true only if "Confirm email"
  // is turned on in Supabase.
  const register = async (name, email, password) => {
    quiet.current = true;
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { data: { full_name: name.trim() } },
      });
      if (error) return { ok: false, message: friendlyMessage(error) };
      const needsConfirmation = !data.session;
      if (data.session) await supabase.auth.signOut();
      return { ok: true, needsConfirmation };
    } finally {
      quiet.current = false;
    }
  };

  // Sends a 6-digit code to the member's email (the "Reset password" email
  // template in Supabase must contain {{ .Token }}). We show the same result
  // for every email address so nobody can use this to find out who has an
  // account.
  const requestPasswordReset = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
    if (error) return { ok: false, message: friendlyMessage(error) };
    return { ok: true };
  };

  // Checks the code, sets the new password, then signs out again so the member
  // logs in themselves. Returns { ok: true } or { ok: false, message, field }.
  const resetPasswordWithCode = async (email, code, newPassword) => {
    quiet.current = true;
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: code.trim(),
        type: 'recovery',
      });
      if (verifyError) return { ok: false, message: friendlyMessage(verifyError), field: 'code' };

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      // Always sign out, so the member is not left logged in by the reset.
      await supabase.auth.signOut();
      if (updateError) {
        return {
          ok: false,
          field: 'password',
          message: friendlyMessage(updateError) + ' Request a new code to try again.',
        };
      }
      return { ok: true };
    } finally {
      quiet.current = false;
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  const value = {
    user,
    isLoggedIn: user !== null,
    isAdmin,
    roleLoading,
    loading,
    login,
    register,
    requestPasswordReset,
    resetPasswordWithCode,
    logout,
  };

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
