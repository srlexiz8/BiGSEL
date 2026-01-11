/* @flow */
import '@babel/register';
import 'ignore-styles';

import url from 'url';
import path from 'path';
import compression from 'compression';
import express from 'express';
import http from 'http';
import etag from 'etag';

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 10000;

import forceGC from './core/forceGC.js';
const assets = require('./assets.json'); 
import logger from './core/logger.js';
import rankings from './core/ranking.js';
import factions from './core/factions.js';
import models from './data/models/index.js'; 

import SocketServer from './socket/SocketServer.js';
import APISocketServer from './socket/APISocketServer.js';

import {
  api,
  tiles,
  chunks,
  admintools,
  resetPassword,
  templateChunks,
} from './routes/index.js';

// Uzantıları kaldırdık, babel/register bunları halledecek
import globeHtml from './components/Globe';
import generateMainPage from './components/Main';

import { SECOND, MONTH } from './core/constants.js';
import { DISCORD_INVITE } from './core/config.js';
import { ccToCoords } from './utils/location.js';
import { startAllCanvasLoops } from './core/tileserver.js';

startAllCanvasLoops();

const app = express();
app.disable('x-powered-by');
const server = http.createServer(app);

const usersocket = new SocketServer();
const apisocket = new APISocketServer();
server.on('upgrade', (request, socket, head) => {
  const { pathname } = url.parse(request.url);
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
app.use(express.static(path.join(__dirname, '../public'), { maxAge: 3 * MONTH, extensions: ['html'] }));
app.use('/discord', (req, res) => res.redirect(DISCORD_INVITE));

app.get('/chunks/templates/:c([0-9]+)/:x([0-9]+)/:y([0-9]+).bmp', templateChunks);
app.get('/chunks/:c([0-9]+)/:x([0-9]+)/:y([0-9]+)(/)?:z([0-9]+)?.bmp', chunks);
app.use('/admintools', admintools);
app.use('/reset_password', resetPassword);

const globeEtag = etag(`${assets.globe.js}`, { weak: true });
app.get('/globe', (req, res) => {
  res.set({ 'Content-Type': 'text/html; charset=utf-8', ETag: globeEtag });
  res.status(200).send(globeHtml);
});

const indexEtag = etag(`${assets.vendor.js},${assets.client.js}`, { weak: true });
app.get(['/', '/invite/*', '/error'], (req, res) => {
  res.set({ 'Content-Type': 'text/html; charset=utf-8', ETag: indexEtag });
  const country = req.headers['cf-ipcountry'];
  const countryCoords = country ? ccToCoords(country) : [0, 0];
  res.status(200).send(generateMainPage(countryCoords));
});

models.associate();
models.sync().then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 Bigsel is LIVE at port ${PORT}`);
  });
}).catch(err => console.error("DB Error:", err));
