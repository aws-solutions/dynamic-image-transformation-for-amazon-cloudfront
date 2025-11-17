import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import {
  AuthUser,
  fetchUserAttributes,
  getCurrentUser,
  signInWithRedirect,
} from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';

interface UserContextType {
  user: AuthUser | null;
  email: string | null;
  loading: boolean;
  checkUser: () => Promise<void>;
}

const UserContext = createContext<UserContextType>({
  user: null,
  email: null,
  loading: true,
  checkUser: () => Promise.resolve(),
});

export const useUser = () => useContext(UserContext);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const LOGOUT_PAGE_PATH = '/auth/logout-complete';
  const isLogoutPage = () => window.location.pathname === LOGOUT_PAGE_PATH;

  useEffect(() => {
    Hub.listen('auth', ({ payload }) => {
      switch (payload.event) {
        case 'signInWithRedirect':
          checkUser();
          break;
        case 'signedOut':
          setUser(null);
          setEmail(null);
          break;
      }
    });
    
    if (!isLogoutPage()) {
      checkUser();
    }
  }, []);

  const checkUser = async () => {
    if (isLogoutPage()) {
      setLoading(false);
      return;
    }

    try {
      const responseUser: AuthUser | null = await getCurrentUser();
      setUser({
        ...responseUser,
      });
      
      try {
        const userAttributesOutput = await fetchUserAttributes();
        setEmail(userAttributesOutput.email ?? null);
      } catch (e) {
        console.log(e);
      }
    } catch (error) {
      console.error(error);
      setUser(null);
      setEmail(null);
      
      if (!isLogoutPage()) {
        try {
          await signInWithRedirect();
        } catch (signInError) {
          console.debug('Sign in error:', signInError);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <UserContext.Provider
      value={{
        user,
        email,
        loading,
        checkUser,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};
