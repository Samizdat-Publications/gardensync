import { render } from 'preact';
import './ui/styles/tokens.css';
import './ui/styles/base.css';
import { App } from './ui/App';
import { startApp } from './ui/appState';

startApp();
const root = document.getElementById('app');
if (root) render(<App />, root);
