import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import { CardCollapseProvider } from './contexts/CardCollapseContext.tsx';
import { ViewportModeProvider } from './contexts/ViewportModeContext.tsx';
import './index.css';

if (typeof window !== 'undefined') {
  registerSW({
    immediate: true,
    onOfflineReady() {
      window.dispatchEvent(
        new CustomEvent('ptg-pwa-sw-status', {detail: {offlineReady: true}})
      );
    },
    onNeedRefresh() {
      window.dispatchEvent(
        new CustomEvent('ptg-pwa-sw-status', {detail: {needRefresh: true}})
      );
    },
  });
}

createRoot(document.getElementById('root')!).render(
  <ViewportModeProvider>
    <CardCollapseProvider>
      <App />
    </CardCollapseProvider>
  </ViewportModeProvider>
);
