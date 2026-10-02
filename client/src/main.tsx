// The React entry point. The app shell and pages arrive in T13.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

const root = document.getElementById('root');
if (!root) throw new Error('index.html has no #root element');

createRoot(root).render(
  <StrictMode>
    <h1>Etsy Listing Assistant</h1>
  </StrictMode>,
);
