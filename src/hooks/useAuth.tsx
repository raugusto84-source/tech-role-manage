import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export type UserRole = 'administrador' | 'vendedor' | 'tecnico' | 'cliente' | 'supervisor' | 'visor_tecnico';

interface Profile {
  id: string;
  user_id: string;
  email: string;
  username: string;
  full_name: string;
  role: UserRole;
  phone?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string, username: string, role?: UserRole, referralCode?: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('useAuth: Setting up auth listener');
    
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('useAuth: Auth state changed:', event, session?.user?.email);
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          console.log('useAuth: User found, loading profile for:', session.user.id, session.user.email);
          // Defer profile fetch to avoid deadlock
          setTimeout(async () => {
            try {
              console.log('useAuth: Fetching profile for user:', session.user.id);
              const { data: profileData, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', session.user.id)
                .maybeSingle();
              
              if (error) {
                console.error('useAuth: Error fetching profile:', error);
                toast({
                  title: "Error al cargar perfil",
                  description: `Error: ${error.message}`,
                  variant: "destructive",
                });
              } else if (profileData) {
                console.log('useAuth: Profile loaded successfully:', profileData);
                setProfile(profileData);
              } else {
                console.log('useAuth: No profile found, creating one...');
                // If no profile exists, create one for the user
                const { data: newProfile, error: createError } = await supabase
                  .from('profiles')
                  .insert({
                    user_id: session.user.id,
                    email: session.user.email || '',
                    username: session.user.user_metadata?.username || `user${Date.now()}`,
                    full_name: session.user.user_metadata?.full_name || 'Usuario',
                    role: (session.user.user_metadata?.role as UserRole) || 'cliente'
                  })
                  .select()
                  .single();
                
                if (createError) {
                  console.error('useAuth: Error creating profile:', createError);
                  toast({
                    title: "Error al crear perfil",
                    description: `Error: ${createError.message}`,
                    variant: "destructive",
                  });
                } else {
                  console.log('useAuth: New profile created successfully:', newProfile);
                  setProfile(newProfile);
                  toast({
                    title: "Perfil creado",
                    description: "Se ha creado tu perfil de usuario",
                    variant: "default",
                  });
                }
              }
            } catch (error) {
              console.error('useAuth: Unexpected error loading profile:', error);
              toast({
                title: "Error inesperado",
                description: "Ocurrió un error al cargar el perfil",
                variant: "destructive",
              });
            }
          }, 0);
        } else {
          console.log('useAuth: No session user found, clearing profile');
          setProfile(null);
        }
        
        setLoading(false);
      }
    );

    // Check for existing session
    console.log('useAuth: Checking for existing session');
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('useAuth: Existing session check:', session?.user?.email || 'No session');
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      console.log('useAuth: Cleaning up auth listener');
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (username: string, password: string) => {
    // First, find the email associated with the username
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('email, role')
      .eq('username', username)
      .single();

    if (profileError || !userProfile) {
      toast({
        title: "Error al iniciar sesión",
        description: "Usuario no encontrado",
        variant: "destructive",
      });
      return { error: new Error('Usuario no encontrado') };
    }

    // Now sign in with the email
    const { error } = await supabase.auth.signInWithPassword({
      email: userProfile.email,
      password,
    });

    if (error) {
      toast({
        title: "Error al iniciar sesión",
        description: error.message,
        variant: "destructive",
      });
    } else {
      // Redirect based on user role after successful login
      setTimeout(() => {
        if (userProfile.role === 'cliente') {
          window.location.href = '/client';
        } else {
          window.location.href = '/dashboard';
        }
      }, 100);
    }

    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string, username: string, role: UserRole = 'cliente', referralCode?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          username: username,
          role: role,
          referral_code: referralCode
        }
      }
    });

    if (error) {
      toast({
        title: "Error al registrarse",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Registro exitoso",
        description: "Verifica tu email para confirmar tu cuenta",
      });
    }

    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    toast({
      title: "Sesión cerrada",
      description: "Has cerrado sesión exitosamente",
    });
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      loading,
      signIn,
      signUp,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}