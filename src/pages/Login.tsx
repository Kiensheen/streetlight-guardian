 import React, { useState } from 'react';
 import { useNavigate } from 'react-router-dom';
 import { useAuth } from '@/contexts/AuthContext';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
 import { Label } from '@/components/ui/label';
 import { Lightbulb, AlertCircle } from 'lucide-react';
 
 const Login: React.FC = () => {
   const [email, setEmail] = useState('');
   const [password, setPassword] = useState('');
   const [error, setError] = useState('');
   const { login, isLoading } = useAuth();
   const navigate = useNavigate();
 
   const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     setError('');
     
     if (!email || !password) {
       setError('Please enter both email and password');
       return;
     }
     
     const success = await login(email, password);
     if (success) {
       navigate('/dashboard');
     } else {
       setError('Invalid credentials. Password must be at least 6 characters.');
     }
   };
 
   return (
     <div className="min-h-screen flex items-center justify-center bg-background p-4">
       <div className="w-full max-w-md">
         <div className="flex items-center justify-center gap-3 mb-8">
           <div className="p-3 rounded-xl bg-primary">
             <Lightbulb className="h-8 w-8 text-primary-foreground" />
           </div>
           <div>
             <h1 className="text-2xl font-bold text-foreground">StreetLight</h1>
             <p className="text-sm text-muted-foreground">Monitoring System</p>
           </div>
         </div>
         
         <Card className="border-border/50 shadow-lg">
           <CardHeader className="space-y-1">
             <CardTitle className="text-2xl text-center">Welcome back</CardTitle>
             <CardDescription className="text-center">
               Sign in to access your streetlight dashboard
             </CardDescription>
           </CardHeader>
           <CardContent>
             <form onSubmit={handleSubmit} className="space-y-4">
               {error && (
                 <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                   <AlertCircle className="h-4 w-4 shrink-0" />
                   {error}
                 </div>
               )}
               
               <div className="space-y-2">
                 <Label htmlFor="email">Email</Label>
                 <Input
                   id="email"
                   type="email"
                   placeholder="admin@streetlight.com"
                   value={email}
                   onChange={(e) => setEmail(e.target.value)}
                   disabled={isLoading}
                 />
               </div>
               
               <div className="space-y-2">
                 <Label htmlFor="password">Password</Label>
                 <Input
                   id="password"
                   type="password"
                   placeholder="••••••••"
                   value={password}
                   onChange={(e) => setPassword(e.target.value)}
                   disabled={isLoading}
                 />
               </div>
               
               <Button type="submit" className="w-full" disabled={isLoading}>
                 {isLoading ? 'Signing in...' : 'Sign in'}
               </Button>
             </form>
           </CardContent>
         </Card>
         
         <p className="text-center text-sm text-muted-foreground mt-6">
           Demo: Use any email and password (6+ characters)
         </p>
       </div>
     </div>
   );
 };
 
 export default Login;