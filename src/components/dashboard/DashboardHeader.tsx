import React from 'react';
import { Button } from '@/components/ui/button';
import { Lightbulb, Moon, Sun } from 'lucide-react';
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
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary">
              <Lightbulb className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-foreground">StreetLight Monitor</h1>
              <p className="text-[10px] text-muted-foreground">ESP32 IoT Dashboard</p>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleDarkMode}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            
            <NotificationCenter
              notifications={notifications}
              unreadCount={unreadCount}
              onMarkAsRead={onMarkAsRead}
              onMarkAllAsRead={onMarkAllAsRead}
            />
          </div>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;
