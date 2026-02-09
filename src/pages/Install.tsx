import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Download, CheckCircle, Smartphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const Install: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setIsInstalled(true);
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-sm w-full border-border/50">
        <CardContent className="p-6 text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            {isInstalled ? (
              <CheckCircle className="h-8 w-8 text-success" />
            ) : (
              <Smartphone className="h-8 w-8 text-primary" />
            )}
          </div>

          <h1 className="text-xl font-bold">
            {isInstalled ? 'App Installed!' : 'Install StreetLight Monitor'}
          </h1>

          <p className="text-sm text-muted-foreground">
            {isInstalled
              ? 'The app is installed on your device. You can open it from your home screen.'
              : 'Install the app on your phone for offline access and a native app experience.'}
          </p>

          {!isInstalled && deferredPrompt && (
            <Button onClick={handleInstall} className="w-full gap-2">
              <Download className="h-4 w-4" />
              Install App
            </Button>
          )}

          {!isInstalled && !deferredPrompt && (
            <div className="text-xs text-muted-foreground space-y-2">
              <p className="font-medium">To install manually:</p>
              <p><strong>Android Chrome:</strong> Tap ⋮ menu → "Add to Home Screen"</p>
              <p><strong>iPhone Safari:</strong> Tap Share → "Add to Home Screen"</p>
            </div>
          )}

          <Button variant="outline" onClick={() => navigate('/')} className="w-full">
            Go to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Install;
