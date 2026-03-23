import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Handle service worker updates
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
      window.location.reload();
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);
