import { usePWA } from '@/contexts/PWAContext';
import { Button } from '@/components/ui/button';
import { Download, RefreshCw } from 'lucide-react';

interface PWAInstallPromptProps {
  className?: string;
}

export const PWAInstallPrompt = ({ className }: PWAInstallPromptProps) => {
  const { isInstallable, hasUpdate, install, update } = usePWA();

  if (!isInstallable && !hasUpdate) {
    return null;
  }

  return (
    <div className={`fixed top-4 right-4 z-50 ${className}`}>
      {isInstallable && (
        <Button
          onClick={install}
          className="bg-green-600 hover:bg-green-700 text-white shadow-lg"
          size="sm"
        >
          <Download className="w-4 h-4 mr-2" />
          Install App
        </Button>
      )}

      {hasUpdate && (
        <Button
          onClick={update}
          className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
          size="sm"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Update Available
        </Button>
      )}
    </div>
  );
};