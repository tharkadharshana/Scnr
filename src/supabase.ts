import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || supabaseUrl === '') {
  console.error(
    'CRITICAL: VITE_SUPABASE_URL is missing. ' +
    'Please set it in your .env file or Vercel environment variables.'
  );
}

export const supabase = createClient(
  supabaseUrl || 'https://missing-supabase-url.supabase.co', 
  supabaseAnonKey || 'missing-anon-key', 
  {
    auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
});

/**
 * Sign in with Google using Supabase OAuth.
 * After login, Supabase automatically stores the session.
 */
export const loginWithGoogle = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + '/',
    }
  });
  if (error) {
    console.error('Google login error:', error.message);
    throw error;
  }
};

/** Email + password. Supabase sends the verification mail; no session until the link is clicked. */
export const signUpWithEmail = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + '/' } });
  if (error) throw error;
  // Existing address: Supabase returns a user with no identities instead of an error (it hides which addresses exist).
  return data;
};

export const loginWithEmail = async (email: string, password: string) => {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
};

export const resendVerification = async (email: string) => {
  const { error } = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: window.location.origin + '/' } });
  if (error) throw error;
};

export const sendPasswordReset = async (email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/' });
  if (error) throw error;
};

export const setNewPassword = async (password: string) => {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
};

/**
 * Sign out the current user.
 */
export const logout = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Logout error:', error.message);
  }
};

/**
 * Get the currently authenticated user (null if not logged in).
 */
export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};
