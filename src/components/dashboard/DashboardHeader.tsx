 import React from 'react';
 import { useAuth } from '@/contexts/AuthContext';
 import { Button } from '@/components/ui/button';
 import { Lightbulb, LogOut, Moon, Sun } from 'lucide-react';
 import NotificationCenter from './NotificationCenter';
 import { Notification } from '@/types/streetlight';
 
 interface DashboardHeaderProps {
   notifications: Notification[];
   unreadCount: number;
   onMarkAsRead: (id: string) => void;
   onMarkAllAsRead: () => void;
   isDarkMode: boolean;
   onToggleDarkMode: () => void;
 }
 
 const DashboardHeader: React.FC<DashboardHeaderProps> = ({
   notifications,
   unreadCount,
   onMarkAsRead,
   onMarkAllAsRead,
   isDarkMode,
   onToggleDarkMode,
 }) => {
   const { user, logout } = useAuth();
 
   return (
     <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
       <div className="container mx-auto px-4 py-3">
         <div className="flex items-center justify-between">
           <div className="flex items-center gap-3">
             <div className="p-2 rounded-lg bg-primary">
               <Lightbulb className="h-5 w-5 text-primary-foreground" />
             </div>
             <div>
               <h1 className="text-lg font-bold text-foreground">StreetLight Monitor</h1>
               <p className="text-xs text-muted-foreground">Real-time monitoring system</p>
             </div>
           </div>
           
           <div className="flex items-center gap-2">
             <Button
               variant="ghost"
               size="icon"
               onClick={onToggleDarkMode}
               className="text-muted-foreground hover:text-foreground"
             >
               {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
             </Button>
             
             <NotificationCenter
               notifications={notifications}
               unreadCount={unreadCount}
               onMarkAsRead={onMarkAsRead}
               onMarkAllAsRead={onMarkAllAsRead}
             />
             
             <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-border">
               <span className="text-sm text-muted-foreground">{user?.email}</span>
               <Button variant="ghost" size="icon" onClick={logout} className="text-muted-foreground hover:text-foreground">
                 <LogOut className="h-4 w-4" />
               </Button>
             </div>
           </div>
         </div>
       </div>
     </header>
   );
 };
 
 export default DashboardHeader;