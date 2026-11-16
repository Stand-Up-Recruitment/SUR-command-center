import { createContext, useContext } from 'react';

export type AuthRole = 'admin' | 'marketing' | 'recruitment';

export const AuthContext = createContext<AuthRole>('admin');

export function useAuthRole(): AuthRole {
  return useContext(AuthContext);
}
