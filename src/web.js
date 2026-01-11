import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// 1. BABEL'İ EN ÖNCE ÇALIŞTIRMAK İÇİN REQUIRE KULLANIYORUZ
require('@babel/register')({
  extensions: ['.js', '.jsx', '.ts', '.tsx'],
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    '@babel/preset-react',
    '@babel/preset-flow',
    '@babel/preset-typescript'
  ],
  plugins: [
    '@babel/plugin-transform-flow-strip-types',
    ['@babel/plugin-proposal-decorators', { legacy: true }],
    ['@babel/plugin-transform-class-properties', { loose: true }],
    '@babel/plugin-transform-object-rest-spread'
  ],
  ignore: [/node_modules/],
  cache: false
});
require('ignore-styles');

// 2. IMPORT ÇAKIŞMASINI ÖNLEMEK İÇİN DİĞER DOSYALARI DA REQUIRE İLE ÇEKİYORUZ
const url = require('url');
const path = require('path');
const compression = require('compression');
const express = require('express');
const http = require('http');
const etag = require('etag');

// Proje Dosyaları
const forceGC = require('./core/forceGC.js');
const assets = require('./assets.json');
const logger = require('./core/logger.js');
const rankings = require('./core/ranking.js');
const factions = require('./core/factions.js');
const models = require('./data/models/index.js');

const SocketServer = require('./socket/SocketServer.js').default || require('./socket/SocketServer.js');
const APISocketServer = require('./socket/APISocketServer.js').default || require('./socket/APISocketServer.js');

const routes = require('./routes/index.js');
const { api, tiles, chunks, admintools, resetPassword, templateChunks } = routes;

// JSX Dosyaları
const globeHtml = require('./components/Globe.jsx').default || require('./components/Globe.jsx');
const generateMainPage = require('./components/Main.jsx').default || require('./components/Main.jsx');

const { SECOND, MONTH } = require('./core/constants.js');
const { DISCORD_INVITE } = require('./core/config.js');
const { ccToCoords } = require('./utils/location.js');
const { startAllCanvasLoops } = require('./core/tileserver.js');

// --- SUNUCU BAŞLATMA ---
const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 10000;

startAllCanvasLoops();
const app = express();
const server = http.createServer(app);

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
