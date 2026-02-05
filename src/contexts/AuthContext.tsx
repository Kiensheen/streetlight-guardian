 import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
 
 interface User {
   email: string;
   name: string;
 }
 
 interface AuthContextType {
   user: User | null;
   isAuthenticated: boolean;
   login: (email: string, password: string) => Promise<boolean>;
   logout: () => void;
   isLoading: boolean;
 }
 
 const AuthContext = createContext<AuthContextType | null>(null);
 
 export const useAuth = () => {
   const context = useContext(AuthContext);
   if (!context) {
     throw new Error('useAuth must be used within an AuthProvider');
   }
   return context;
 };
 
 interface AuthProviderProps {
   children: ReactNode;
 }
 
 export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
   const [user, setUser] = useState<User | null>(() => {
     const stored = localStorage.getItem('streetlight_user');
     return stored ? JSON.parse(stored) : null;
   });
   const [isLoading, setIsLoading] = useState(false);
 
   const login = useCallback(async (email: string, password: string): Promise<boolean> => {
     setIsLoading(true);
     
     // Simple authentication - in production, this would validate against Firebase Auth
     await new Promise(resolve => setTimeout(resolve, 800));
     
     if (email && password.length >= 6) {
       const newUser = { email, name: email.split('@')[0] };
       setUser(newUser);
       localStorage.setItem('streetlight_user', JSON.stringify(newUser));
       setIsLoading(false);
       return true;
     }
     
     setIsLoading(false);
     return false;
   }, []);
 
   const logout = useCallback(() => {
     setUser(null);
     localStorage.removeItem('streetlight_user');
   }, []);
 
   return (
     <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout, isLoading }}>
       {children}
     </AuthContext.Provider>
   );
 };