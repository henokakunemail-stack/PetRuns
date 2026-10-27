import React, { createContext, useContext, useState, useEffect } from 'react';

export interface User {
  id: string;
  phone: string;
  fullName: string;
  role: 'OWNER' | 'WORKER' | 'ADMIN';
}

export interface AuthContextType {
  token: string | null;
  user: User | null;
  isGuest: boolean;
  isLoading: boolean;
  isOtpModalVisible: boolean;
  openOtpModal: (onSuccessCallback?: () => void) => void;
  closeOtpModal: () => void;
  requestOtp: (phone: string) => Promise<boolean>;
  verifyOtp: (phone: string, code: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

// Secure storage adapter interface (backed by react-native-keychain in production)
export interface SecureStorageAdapter {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

export const inMemorySecureStorage: SecureStorageAdapter = (() => {
  const store = new Map<string, string>();
  return {
    getItem: async (key: string) => store.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: async (key: string) => {
      store.delete(key);
    },
  };
})();

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export interface AuthProviderProps {
  children: React.ReactNode;
  storage?: SecureStorageAdapter;
  apiBaseUrl?: string;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({
  children,
  storage = inMemorySecureStorage,
  apiBaseUrl = 'https://api.petmatch.id',
}) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isOtpModalVisible, setOtpModalVisible] = useState<boolean>(false);
  const [pendingCallback, setPendingCallback] = useState<(() => void) | null>(null);

  useEffect(() => {
    // Hydrate token on boot
    const hydrate = async () => {
      try {
        const savedToken = await storage.getItem('petmatch_jwt_token');
        const savedUser = await storage.getItem('petmatch_user');
        if (savedToken && savedUser) {
          setToken(savedToken);
          setUser(JSON.parse(savedUser) as User);
        }
      } catch (err) {
        console.warn('Failed to hydrate credentials from secure storage', err);
      } finally {
        setIsLoading(false);
      }
    };
    hydrate();
  }, [storage]);

  const openOtpModal = (onSuccessCallback?: () => void) => {
    if (onSuccessCallback) {
      setPendingCallback(() => onSuccessCallback);
    }
    setOtpModalVisible(true);
  };

  const closeOtpModal = () => {
    setOtpModalVisible(false);
    setPendingCallback(null);
  };

  const requestOtp = async (phone: string): Promise<boolean> => {
    try {
      const res = await fetch(`${apiBaseUrl}/auth/otp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      return res.ok;
    } catch {
      return false;
    }
  };

  const verifyOtp = async (phone: string, code: string): Promise<boolean> => {
    try {
      const res = await fetch(`${apiBaseUrl}/auth/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      });
      if (!res.ok) return false;

      const data = (await res.json()) as { token: string; user: User };
      setToken(data.token);
      setUser(data.user);

      // Persist in Keychain / Keystore secure storage
      await storage.setItem('petmatch_jwt_token', data.token);
      await storage.setItem('petmatch_user', JSON.stringify(data.user));

      setOtpModalVisible(false);
      if (pendingCallback) {
        pendingCallback();
        setPendingCallback(null);
      }
      return true;
    } catch {
      return false;
    }
  };

  const logout = async () => {
    setToken(null);
    setUser(null);
    await storage.removeItem('petmatch_jwt_token');
    await storage.removeItem('petmatch_user');
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isGuest: !token,
        isLoading,
        isOtpModalVisible,
        openOtpModal,
        closeOtpModal,
        requestOtp,
        verifyOtp,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
