import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { APP_CONFIG } from './config';
import 'tdesign-react/esm/style/index.js';
import './index.css';

// 设置页面标题
document.title = APP_CONFIG.name;

// 使用 HashRouter：静态托管（GitHub Pages 等）无需服务端 rewrite 即可深链 /#/checkin
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
);
