const http = require("http");
const fs = require('fs');
const SocketIO = require('socket.io');
const {randomUUID} = require('crypto');

const pino = require('pino')();
const pinoHttp = require('pino-http')({logger: pino});

// prepares files to be served
const html = fs.readFileSync(__dirname + '/dist/room.html', 'utf8');
const css = fs.readFileSync(__dirname + '/dist/style.css', 'utf8');

const httpServer = http.createServer((req, res) => {
    pinoHttp(req, res);
    if (req.url === '/') {
        res.writeHead(200, {"Content-Type": "text/plain"});
        res.end(`https://ghostie.link/${randomUUID()}`);
    } else if (req.url === '/style.css') {
        res.writeHead(200, {"Content-Type": "text/css", 'Content-Length': Buffer.byteLength(css)});
        res.end(css);
    } else if (!(req.url.split(/\/(?=.)/).length === 2)) {
        // not a valid URL (ie. contains subdirectories)
        res.writeHead(404, {"Content-Type": "text/plain"});
        res.end("404 Not Found");
    } else {
        if (req.method === 'GET') {
            res.writeHead(200, {"Content-Type": "text/html", 'Content-Length': Buffer.byteLength(html)});
            res.end(html);
        } else {
            let event = '';
            req.on('data', function (data) {
                event += data;
            });
            req.on('end', function () {
                io.sockets.in(req.url).emit("event", event);
                res.writeHead(200);
                res.end();
            });
        }
    }
});

// attach Socket.io to our HTTP server
const io = SocketIO(httpServer);

// handle incoming connections from clients
io.on("connection", (socket) => {
    pino.debug({"event": "connected", "msg": "new connection", "socket_id": socket.id});
    // once a client has connected, we expect to get a ping from them saying what room they want to join
    socket.on('join', async (room) => {
        pino.debug({"event": "join", "msg": "joined", "socket_id": socket.id, "room": room});
        socket.join(room);
        //socket.emit("event", history);
    });
    socket.on('disconnected', async (room) => {
        pino.debug({"event": "disconnected", "msg": "socket disconnected", "socket_id": socket.id, "room": room});
    });
});

// starts up server
httpServer.listen(3000, () => {
    pino.info('listening on http://localhost:3000');
});
