

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import type { User, Session } from '@supabase/supabase-js';
import type { Database } from '../services/database.types';

interface AppUser {
  id: string;
  email?: string;
  name: string;
  avatarUrl: string;
}

type ScheduleWithClassName = Database['public']['Tables']['schedules']['Row'] & {
    className?: string;
};

// --- Service Worker and Notification Logic ---
// This remains a top-level helper function as it's pure and reusable.
const setupServiceWorker = async () => {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
            await navigator.serviceWorker.ready;
            return registration;
        } catch (error) {
            console.error('Service Worker registration failed:', error);
            return null;
        }
    }
    return null;
}

// --- Auth Context and Provider ---

interface AuthContextType {
  session: Session | null;
  user: AppUser | null;
  loading: boolean;
  isNotificationsEnabled: boolean;
  login: (email: string, password?: string) => Promise<any>;
  logout: () => Promise<void>;
  updateUser: (data: { name?: string; avatar_url?: string; password?: string }) => Promise<any>;
  signup: (name: string, email: string, password?: string) => Promise<any>;
  enableScheduleNotifications: (schedule: ScheduleWithClassName[]) => Promise<boolean>;
  disableScheduleNotifications: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isNotificationsEnabled, setIsNotificationsEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
        return localStorage.getItem('scheduleNotificationsEnabled') === 'true';
    }
    return false;
  });

  // Centralized function to process user data and apply cache-busting
  const processUser = (authUser: User | undefined | null): AppUser | null => {
    if (!authUser) return null;

    let avatarUrl = authUser.user_metadata.avatar_url || `https://i.pravatar.cc/150?u=${authUser.id}`;
    
    if (avatarUrl && avatarUrl.includes('supabase.co')) {
        avatarUrl = `${avatarUrl.split('?')[0]}?t=${new Date().getTime()}`;
    }

    return {
        id: authUser.id,
        email: authUser.email,
        name: authUser.user_metadata.name || 'Guru',
        avatarUrl: avatarUrl
    };
  };


  useEffect(() => {
    const fetchSession = async () => {
        const { data, error } = await supabase.auth.getSession();
        if (error) console.error("Error fetching session:", error);
        setSession(data.session);
        setUser(processUser(data.session?.user));
        setLoading(false);
    };
    
    fetchSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(processUser(session?.user));
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const enableScheduleNotifications = async (schedule: ScheduleWithClassName[]): Promise<boolean> => {
      if (!('Notification' in window) || !('serviceWorker' in navigator)) {
          alert('Browser Anda tidak mendukung notifikasi.');
          return false;
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
          alert('Izin notifikasi tidak diberikan.');
          return false;
      }
      
      const registration = await setupServiceWorker();
      if (registration && registration.active) {
          registration.active.postMessage({
              type: 'SCHEDULE_UPDATED',
              payload: schedule,
          });
          localStorage.setItem('scheduleNotificationsEnabled', 'true');
          setIsNotificationsEnabled(true);
          return true;
      }
      return false;
  };

  const disableScheduleNotifications = async () => {
      if ('serviceWorker' in navigator) {
          try {
              const registration = await navigator.serviceWorker.getRegistration();
              if (registration && registration.active) {
                  registration.active.postMessage({ type: 'CLEAR_SCHEDULE' });
              }
          } catch (error) {
              console.error('Failed to clear notifications:', error);
          }
      }
      localStorage.removeItem('scheduleNotificationsEnabled');
      setIsNotificationsEnabled(false);
  };

  const value: AuthContextType = {
    session,
    user,
    loading,
    isNotificationsEnabled,
    login: (email, password) => supabase.auth.signInWithPassword({ email: email!, password: password! }),
    signup: (name, email, password) => supabase.auth.signUp({
      email: email,
      password: password!,
      options: {
        data: {
          name,
          avatar_url: `https://i.pravatar.cc/150?u=${email}`
        }
      }
    }),
    logout: async () => {
        await disableScheduleNotifications();
        await supabase.auth.signOut();
    },
    updateUser: (data) => supabase.auth.updateUser({
        password: data.password,
        data: {
            name: data.name,
            avatar_url: data.avatar_url
        }
    }),
    enableScheduleNotifications,
    disableScheduleNotifications,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
