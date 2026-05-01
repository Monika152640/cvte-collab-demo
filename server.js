const http = require('http');
const WebSocket = require('ws');
const { setupWSConnection } = require('y-websocket/bin/utils');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

wss.on('connection', setupWSConnection);

const port = process.env.PORT || 1234;
server.listen(port, () => {
  console.log(`Listening on: http://localhost:${port}`);
});