
import React, { useState, useEffect } from 'react';
import { Button } from './ui/Button';
import { DownloadCloudIcon } from './Icons';

// This is a browser event type, so we declare it for TypeScript
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: Array<string>;
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed',
    platform: string,
  }>;
  prompt(): Promise<void>;
}

const PwaPrompt: React.FC = () => {
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setInstallPromptEvent(e as BeforeInstallPromptEvent);
      // Check if user has dismissed it before in this session
      if (!sessionStorage.getItem('pwa-prompt-dismissed')) {
          setIsVisible(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = () => {
    if (!installPromptEvent) {
      return;
    }
    // Show the install prompt
    installPromptEvent.prompt();
    // Wait for the user to respond to the prompt
    installPromptEvent.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt');
      } else {
        console.log('User dismissed the install prompt');
      }
      setInstallPromptEvent(null);
      setIsVisible(false);
    });
  };

  const handleDismiss = () => {
      setIsVisible(false);
      sessionStorage.setItem('pwa-prompt-dismissed', 'true');
  }

  if (!isVisible || !installPromptEvent) {
    return null;
  }

  return (
    <div className="fixed bottom-20 lg:bottom-4 left-4 right-4 lg:left-1/2 lg:-translate-x-1/2 lg:w-full lg:max-w-lg z-[60] animate-slide-up">
      <div className="bg-gradient-to-r from-sky-600 to-blue-600 dark:from-purple-600 dark:to-blue-600 backdrop-blur-lg text-white rounded-2xl shadow-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 border border-white/20">
        <div className="flex items-center gap-3 flex-1">
          <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <DownloadCloudIcon className="w-6 h-6"/>
          </div>
          <div className="flex-grow min-w-0">
            <p className="font-bold text-base">Install Aplikasi Manajemen Guru</p>
            <p className="text-xs sm:text-sm text-white/90 mt-0.5">Akses cepat, bekerja offline, notifikasi real-time</p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button size="sm" variant="ghost" onClick={handleDismiss} className="flex-1 sm:flex-none bg-white/10 hover:bg-white/20 text-white border-white/20">Nanti</Button>
            <Button size="sm" onClick={handleInstallClick} className="flex-1 sm:flex-none bg-white text-sky-600 dark:text-purple-600 hover:bg-white/90">Install</Button>
        </div>
      </div>
    </div>
  );
};

export default PwaPrompt;