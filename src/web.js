/* @flow */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Babel'i uzantılarla birlikte kaydediyoruz
require('@babel/register')({
  extensions: ['.js', '.jsx'],
  presets: ['@babel/preset-env', '@babel/preset-react']
});
require('ignore-styles');

import url from 'url';
import path from 'path';
import compression from 'compression';
import express from 'express';
import http from 'http';
import etag from 'etag';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 10000;

// Çekirdek dosyalar (Uzantılı yollar)
import forceGC from './core/forceGC.js';
const assets = require('./assets.json'); 
import logger from './core/logger.js';
import rankings from './core/ranking.js';
import factions from './core/factions.js';
import models from './data/models/index.js'; //

import SocketServer from './socket/SocketServer.js';
import APISocketServer from './socket/APISocketServer.js';

import { api, tiles, chunks, admintools, resetPassword, templateChunks } from './routes/index.js';

// KESİN ÇÖZÜM: Node.js 20 import ile .jsx dosyasını doğrudan bulamaz. 
// Bu yüzden Babel ile işlenmiş dosyaları 'require' ile çekiyoruz.
const globeHtml = require('./components/Globe.jsx').default || require('./components/Globe.jsx');
const generateMainPage = require('./components/Main.jsx').default || require('./components/Main.jsx');

import { SECOND, MONTH } from './core/constants.js';
import { DISCORD_INVITE } from './core/config.js';
import { ccToCoords } from './utils/location.js';
import { startAllCanvasLoops } from './core/tileserver.js';

startAllCanvasLoops();

const app = express();
app.disable('x-powered-by');
const server = http.createServer(app);

// Websocket Yükseltme
server.on('upgrade', (request, socket, head) => {
  const { pathname } = url.parse(request.url);
  const usersocket = new SocketServer();
  const apisocket = new APISocketServer();
  
  if (pathname === '/ws') {
    usersocket.wss.handleUpgrade(request, socket, head, (ws) => usersocket.wss.emit('connection', ws, request));
  } else if (pathname === '/mcws') {
    apisocket.wss.handleUpgrade(request, socket, head, (ws) => apisocket.wss.emit('connection', ws, request));
  } else {
    socket.destroy();
  }
});

app.use('/api', api);
app.use('/tiles', tiles);
app.use(compression({ level: 3 }));
app.use(express.static(path.join(__dirname, '../public'), { maxAge: 3 * MONTH }));

app.get('/globe', (req, res) => {
  res.set({ 'Content-Type': 'text/html; charset=utf-8' });
  res.status(200).send(globeHtml);
});

app.get(['/', '/invite/*', '/error'], (req, res) => {
  res.set({ 'Content-Type': 'text/html; charset=utf-8' });
  const country = req.headers['cf-ipcountry'];
  const countryCoords = country ? ccToCoords(country) : [0, 0];
  res.status(200).send(generateMainPage(countryCoords));
});

models.associate();
models.sync().then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 Bigsel is LIVE at port ${PORT}`);
  });
}).catch(err => console.error("Database Error:", err));
