import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {registerAxionServiceWorker} from './lib/pushNotifications.ts';

if ('serviceWorker' in navigator) void registerAxionServiceWorker().catch(() => undefined);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
