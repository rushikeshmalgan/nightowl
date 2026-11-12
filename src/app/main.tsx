import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '../index.css';
import { requestPersistence } from '../features/library/library';

// Ask the browser to keep the library when storage runs low.
void requestPersistence();

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
