const http = require("http");
const fs = require('fs');
const SocketIO = require('socket.io');
const { randomUUID } = require('crypto');
const cronJob = require("cron").CronJob;

const v4 = new RegExp(/[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89aAbB][a-f0-9]{3}-[a-f0-9]{12}/);

// setup loggers
const pino = require('pino')();
const pinoHttp = require('pino-http')({ logger: pino });

// prepare database and statements
const db = require('better-sqlite3')('ghostie.db', { verbose: pino.debug });
db.prepare("CREATE TABLE IF NOT EXISTS chat_history('room' varchar, 'event' varchar, 'insertedAt' varchar);").run();

const insertStmt = db.prepare('INSERT INTO chat_history (room, event, insertedAt) VALUES (?, ?, ?);');
const selectStmt = db.prepare('SELECT * FROM chat_history WHERE room = ? ORDER BY insertedAt ASC LIMIT 100;');
const deleteStmt = db.prepare('DELETE FROM chat_history WHERE room = ?;');
const cronDeleteSmt = db.prepare('DELETE FROM chat_history WHERE insertedAt <= strftime(\'%s\', \'now\');\n')

// delete rooms that are older than 10 days
new cronJob('0 0 0 */10 * *', () => {
    pino.debug({ "event": "cronJob", "msg": "cron delete history" });
    cronDeleteSmt.run();
});

// read static files at startup
const html = fs.readFileSync(__dirname + '/dist/room.html', 'utf8');
const css = fs.readFileSync(__dirname + '/dist/style.css', 'utf8');

const httpServer = http.createServer((req, res) => {
    pinoHttp(req, res);
    if (req.url === '/') {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end(`https://ghostie.link/${randomUUID()}`);
    } else if (req.url === '/style.css') {
        res.writeHead(200, { "Content-Type": "text/css", 'Content-Length': Buffer.byteLength(css) });
        res.end(css);
    } else if (req.url.match(v4)) {
        if (req.method === 'GET') {
            res.writeHead(200, { "Content-Type": "text/html", 'Content-Length': Buffer.byteLength(html) });
            res.end(html);
        } else if (req.method === 'POST') {
            let event = '';
            req.on('data', function (data) {
                event += data;
            });
            req.on('end', function () {
                const room = req.url;
                // commit to room history
                const insertedAt = new Date().toISOString();
                insertStmt.run(room, event, insertedAt);
                // emit event
                io.sockets.in(room).emit("event", event, insertedAt);
                // respond with success
                res.writeHead(200);
                res.end();
            });
        } else if (req.method === 'DELETE') {
            const room = req.url;
            // delete room history
            deleteStmt.run(room);
            // respond with success
            res.writeHead(200);
            res.end();
        } else {
            res.writeHead(405, { "Content-Type": "text/plain" });
            res.end("Method Not Allowed");
        }
    } else {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not Found");
    }
});

// attach Socket.io to our HTTP server
const io = SocketIO(httpServer);

// handle incoming connections from clients
io.on("connection", (socket) => {
    pino.debug({ "event": "connected", "msg": "new connection", "socket_id": socket.id });
    // once a client is connected, we expect to get a ping from them saying what room they want to join
    socket.on('join', async (room) => {
        pino.debug({ "event": "join", "msg": "joined", "socket_id": socket.id, "room": room });
        socket.join(room);
        // send history to client
        const roomHistory = selectStmt.all(room);
        if (roomHistory) {
            pino.debug({ "event": "join", "msg": "restored history", "socket_id": socket.id, "room": room });
            for (const event of roomHistory) {
                socket.emit("event", event.event, event.insertedAt, true);
            }
        }
    });
    socket.on('disconnected', async (room) => {
        pino.debug({ "event": "disconnected", "msg": "socket disconnected", "socket_id": socket.id, "room": room });
    });
});

// starts up server
httpServer.listen(3000, () => {
    pino.info('listening on http://localhost:3000');
});
