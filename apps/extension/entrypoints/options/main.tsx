import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App.tsx';

import '../../src/pages/pages.css';
import './style.css';

const root = document.getElementById('root');
if (!root) throw new Error('Fishnet options: #root not found');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
