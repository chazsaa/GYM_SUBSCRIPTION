
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

// Turn Supabase technical errors into readable messages.
const friendlyMessage = (error) => {
  const text = (error?.message || '').toLowerCase();

  if (text.includes('invalid login credentials')) {
    return 'Incorrect email or password. Please try again.';
  }
  if (
    text.includes('already registered') ||
    error?.code === 'user_already_exists'
  ) {
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
  const [loading, setLoading] = useState(true);

  const quiet = useRef(false);

  // Current authenticated user's role.
  const [roleState, setRoleState] = useState({
    userId: null,
    role: 'member',
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (quiet.current) return;
        setSession(nextSession);
      }
    );

    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user?.id ?? null;

  // Determine whether the logged-in account is an admin or a member.
  useEffect(() => {
    if (!userId) {
      setRoleState({
        userId: null,
        role: 'member',
      });
      return undefined;
    }

    let cancelled = false;

    const loadRole = async () => {
      try {
        // user_roles is the single source of truth. is_admin() on the server reads it
        // too, so the app and the database can never disagree about who is an admin.
        const { data: roleData, error: roleError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .maybeSingle();

        if (roleError) throw roleError;

        // Only two roles exist: admin (a row in user_roles) and member (no row).
        let role = roleData?.role === 'admin' ? 'admin' : 'member';

        // Safety net: if the app is updated before supabase/phase4_roles.sql has been
        // run, an admin has no user_roles row yet. Ask the server, so nobody is locked out.
        if (role === 'member') {
          const { data: serverSaysAdmin } = await supabase.rpc('is_admin');
          if (serverSaysAdmin === true) role = 'admin';
        }

        if (!cancelled) {
          setRoleState({
            userId,
            role,
          });
        }
      } catch (error) {
        console.error('Unable to load user role:', error);

        if (!cancelled) {
          setRoleState({
            userId,
            role: 'member',
          });
        }
      }
    };

    loadRole();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const roleLoading =
    userId !== null && roleState.userId !== userId;

  const role = roleLoading ? 'member' : roleState.role;

  const isAdmin = !roleLoading && role === 'admin';
  const isMember = !roleLoading && role === 'member';

  const user = session
    ? {
        id: session.user.id,
        name: session.user.user_metadata?.full_name || '',
        email: session.user.email,
      }
    : null;

  // Login
  const login = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      return {
        ok: false,
        message: friendlyMessage(error),
      };
    }

    return { ok: true };
  };

  // Registration
  const register = async (name, email, password) => {
    quiet.current = true;

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: name.trim(),
          },
        },
      });

      if (error) {
        return {
          ok: false,
          message: friendlyMessage(error),
        };
      }

      const needsConfirmation = !data.session;

      if (data.session) {
        await supabase.auth.signOut();
      }

      return {
        ok: true,
        needsConfirmation,
      };
    } finally {
      quiet.current = false;
    }
  };

  // Request password reset
  const requestPasswordReset = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase()
    );

    if (error) {
      return {
        ok: false,
        message: friendlyMessage(error),
      };
    }

    return { ok: true };
  };

  // Verify reset code and update password
  const resetPasswordWithCode = async (
    email,
    code,
    newPassword
  ) => {
    quiet.current = true;

    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: code.trim(),
        type: 'recovery',
      });

      if (verifyError) {
        return {
          ok: false,
          message: friendlyMessage(verifyError),
          field: 'code',
        };
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      await supabase.auth.signOut();

      if (updateError) {
        return {
          ok: false,
          field: 'password',
          message:
            friendlyMessage(updateError) +
            ' Request a new code to try again.',
        };
      }

      return { ok: true };
    } finally {
      quiet.current = false;
    }
  };

  // Logout
  const logout = async () => {
    await supabase.auth.signOut();
  };

  const value = {
    user,
    role,

    isLoggedIn: user !== null,

    isAdmin,
    isMember,

    roleLoading,
    loading,

    login,
    register,
    requestPasswordReset,
    resetPasswordWithCode,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>.');
  }

  return context;
};
