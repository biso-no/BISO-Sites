"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { getLoggedInUser, listIdentities } from "../actions/user";
import { Models } from "@repo/api";
import { createJWT } from "../actions/user";
import { clientSideClient } from "@repo/api/client";

interface AuthContextType {
  user: Models.User<Models.Preferences> | undefined;
  profile: Models.Document | undefined;
  identities: Models.Identity[] | undefined;
  setUser: (user: Models.User<Models.Preferences> | undefined) => void;
  setProfile: (profile: Models.Document | undefined) => void;
  setIdentities: (identities: Models.Identity[] | undefined) => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: undefined,
  profile: undefined,
  identities: undefined,
  setUser: () => {},
  setProfile: () => {},
  setIdentities: () => {},
  isLoading: true,
});

export function AuthProvider({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [user, setUser] = useState<Models.User<Models.Preferences> | undefined>();
  const [profile, setProfile] = useState<Models.Document | undefined>();
  const [identities, setIdentities] = useState<Models.Identity[] | undefined>();
  const [jwt, setJWT] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function initSession() {
      const token = await createJWT();
      if (!token) {
        console.log("Not authenticated.")
        return;
      }
      clientSideClient.setJWT(token)
    }
    try {
    initSession()
    console.log("Client initialized")
    } catch (error: any) {
      console.log("Error: ", error)
    }

  }, []);

  useEffect(() => {
    async function getUser() {
      try {
        setIsLoading(true);
        const userData = await getLoggedInUser();
        setUser(userData?.user);
        setProfile(userData?.profile);
      } catch (error) {
        console.error('Failed to load user:', error);
      } finally {
        setIsLoading(false);
      }
    }
    getUser();
  }, []);

  useEffect(() => {
    async function getJWT() {
      if (!jwt) {
        const jwt = await createJWT();
        setJWT(jwt as string);
        clientSideClient.setJWT(jwt as string);
      }
    }
    getJWT();
  }, [jwt]);

  useEffect(() => {
    async function getIdentities() {
      if (!identities) {
        const identities = await listIdentities();
      setIdentities(identities?.identities);
    }
}
   getIdentities();
}, [identities]);
  

  return (<AuthContext.Provider value={{
    user,
    profile,
    identities,
    setUser,
    setProfile,
    setIdentities,
    isLoading
  }}>
    {children}
  </AuthContext.Provider>);
}

export function useAuth() {
  return useContext(AuthContext);
}

