import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import App from './App.jsx';
import './styles.css';

if (Capacitor.isNativePlatform()) document.documentElement.classList.add('native');

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
