import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { defineSlideElements } from './lib/elements.js';
import './styles/global.css';
import './styles/slides.css';

defineSlideElements();
createRoot(document.getElementById('root')).render(<App />);
