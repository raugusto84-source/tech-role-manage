import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export type UserRole = 'administrador' | 'vendedor' | 'tecnico' | 'cliente' | 'supervisor';

interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string, role?: UserRole, referralCode?: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [shouldRedirectAfterProfile, setShouldRedirectAfterProfile] = useState(false);

  // Redirige cuando ya tenemos perfil listo y nos lo solicitaron
  useEffect(() => {
    if (!shouldRedirectAfterProfile || !profile) return;
    if (profile.role === 'cliente') {
      window.location.href = '/client';
    } else {
      window.location.href = '/dashboard';
    }
    setShouldRedirectAfterProfile(false);
  }, [shouldRedirectAfterProfile, profile]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      setSession(newSession ?? null);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        // Carga/crea perfil
        try {
          const uid = newSession.user.id;
          const userEmail = newSession.user.email || '';
          const fullName = (newSession.user.user_metadata?.full_name as string) || 'Usuario';
          const role = (newSession.user.user_metadata?.role as UserRole) || 'cliente';

          const { data: profileData, error: selErr } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', uid)
            .maybeSingle();

          if (selErr) {
            // Error de lectura de perfil: informar como tal (no credenciales)
            console.error('Error select profiles:', selErr);
            toast({
              title: 'Error al cargar perfil',
              description: `No se pudo leer tu perfil. Revisa políticas RLS/tabla "profiles".`,
              variant: 'destructive',
            });
            setProfile(null);
            setLoading(false);
            return;
          }

          if (profileData) {
            setProfile(profileData);
          } else {
            // Crear perfil si no existe
            const { data: newProf, error: insErr } = await supabase
              .from('profiles')
              .insert({
                user_id: uid,
                email: userEmail,
                full_name: fullName,
                role,
              })
              .select()
              .single();

            if (insErr) {
              console.error('Error insert profiles:', insErr);
              toast({
                title: 'Error al crear perfil',
                description: `No se pudo crear tu perfil. Revisa políticas RLS de INSERT.`,
                variant: 'destructive',
              });
              setProfile(null);
              setLoading(false);
              return;
            }
            setProfile(newProf);
            toast({ title: 'Perfil creado', description: 'Se ha creado tu perfil de usuario.' });
          }
        } catch (e) {
          console.error('Unexpected profile load error:', e);
          toast({
            title: 'Error inesperado',
            description: 'Ocurrió un error al cargar el perfil.',
            variant: 'destructive',
          });
          setProfile(null);
        }
      } else {
        setProfile(null);
      }

      setLoading(false);
    });

    // Chequeo de sesión al montar
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session ?? null);
      setUser(session?.user ?? null);
      setLoading(false);
      // Nota: el listener también disparará INITIAL_SESSION y hará la carga de perfil
    });

    return () => subscription.unsubscribe();
  }, []);

  const parseAuthError = (msg?: string) => {
    const m = (msg || '').toLowerCase();
    if (m.includes('email not confirmed') || m.includes('confirm')) {
      return 'Tu correo no está confirmado. Revisa tu bandeja o solicita reenvío.';
    }
    if (m.includes('invalid login') || m.includes('invalid credentials') || m.includes('invalid email or password')) {
      return 'Email o contraseña incorrectos. Verifica e intenta de nuevo.';
    }
    return msg || 'No se pudo iniciar sesión.';
  };

  const signIn = async (email: string, password: string) => {
    // Sanitiza entradas (muy importante en móvil)
    const emailClean = (email || '').trim().toLowerCase();
    const passwordClean = (password || '').trim();

    // Si usas Bot Protection (Turnstile/hCaptcha), aquí obtén el token y mándalo en options.captchaToken
    // const captchaToken = await getCaptchaTokenSomehow();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailClean,
      password: passwordClean,
      // options: { captchaToken }
    });

    if (error) {
      toast({
        title: 'Error al iniciar sesión',
        description: parseAuthError(error.message),
        variant: 'destructive',
      });
    } else {
      // Marca que redirijamos cuando el perfil ya esté cargado por el listener
      setShouldRedirectAfterProfile(true);
    }

    return { error };
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    role: UserRole = 'cliente',
    referralCode?: string
  ) => {
    const redirectUrl = `${window.location.origin}/`;
    const emailClean = (email || '').trim().toLowerCase();
    const passwordClean = (password || '').trim();

    const { error } = await supabase.auth.signUp({
      email: emailClean,
      password: passwordClean,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          role,
          referral_code: referralCode,
        },
      },
    });

    if (error) {
      toast({
        title: 'Error al registrarse',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Registro exitoso',
        description: 'Verifica tu email para confirmar tu cuenta.',
      });
    }

    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setShouldRedirectAfterProfile(false);
    toast({ title: 'Sesión cerrada', description: 'Has cerrado sesión exitosamente' });
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
