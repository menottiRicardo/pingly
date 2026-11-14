import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'pingly/styles.css';
import './playground.css';
import { App } from './App';
import { ErrorBoundary } from './ErrorBoundary';
import { SettingsProvider } from './settings';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <SettingsProvider>
        <App />
      </SettingsProvider>
    </ErrorBoundary>
  </StrictMode>,
);
