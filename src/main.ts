import './styles/app.css';
import { App } from './app.js';

// Initialize the SaaS Digital Memory Book application
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => App.init());
} else {
  App.init();
}
