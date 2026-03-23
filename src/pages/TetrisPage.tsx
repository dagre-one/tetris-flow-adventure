import TetrisGame from '@/components/TetrisGame';
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';

const TetrisPage = () => {
  const handleClose = () => {
    window.history.back();
  };

  return (
    <div className="min-h-screen bg-background">
      <PWAInstallPrompt />
      <TetrisGame onClose={handleClose} isOverlay={false} />
    </div>
  );
};

export default TetrisPage;