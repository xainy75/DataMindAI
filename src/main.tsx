import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Fix for ResizeObserver loop completed with undelivered notifications
if (typeof window !== 'undefined') {
  const resizeObserverErrMessages = [
    'ResizeObserver loop completed with undelivered notifications.',
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
    'Script error.'
  ];

  // 1. Support for overriding ResizeObserver to wrap callbacks in requestAnimationFrame
  const RO = window.ResizeObserver;
  if (RO) {
    window.ResizeObserver = class ResizeObserver extends RO {
      constructor(callback: ResizeObserverCallback) {
        super((entries, observer) => {
          window.requestAnimationFrame(() => {
            try {
              callback(entries, observer);
            } catch (e) {
              // Silently ignore callback errors related to ResizeObserver loops
              const msg = e instanceof Error ? e.message : String(e);
              if (!resizeObserverErrMessages.some(m => msg.includes(m))) {
                console.error('ResizeObserver callback inner error:', e);
              }
            }
          });
        });
      }
    };
  }

  // 2. Global error handlers as backup
  const handleError = (msg: string | any) => {
    const errorMsg = typeof msg === 'string' ? msg : (msg?.message || String(msg));
    return resizeObserverErrMessages.some(m => errorMsg.includes(m));
  };

  window.addEventListener('error', (e: ErrorEvent) => {
    if (handleError(e.message) || handleError(e.error)) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  }, true);

  window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
    if (handleError(e.reason)) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  }, true);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
