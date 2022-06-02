const http = require("http");
const fs = require('fs');
const io = require('socket.io')();
const {randomUUID} = require('crypto');

const server = http.createServer(function (req, res) {
    if (req.url === '/') {
        res.writeHead(200, {"Content-Type": "text/plain"});
        res.write(`https://ghostie.link/${randomUUID()}`, "utf8");
        res.end();
    } else if (req.url === '/style.css') {
        fs.readFile("./dist/style.css", function (err, css) {
            if (err) throw err;
            res.writeHead(200, {"Content-Type": "text/css"});
            res.write(css, "utf8");
            res.end();
        });
    } else if (!(req.url.split(/\/(?=.)/).length === 2)) {
        // not a valid URL (ie. contains subdirectories)
        res.writeHead(404, {"Content-Type": "text/plain"});
        res.write("404 Not Found", "utf8");
        res.end();
    } else {
        if (req.method === 'GET') {
            fs.readFile("./dist/room.html", function (err, html) {
                if (err) throw err;
                res.writeHead(200, {"Content-Type": "text/html"});
                res.write(html, "utf8");
                res.end();
            });
        } else {
            // TODO - limit size of POST body
            let body = '';
            req.on('data', function (data) {
                body += data;
            });
            req.on('end', function () {
                io.to(`room${req.url}`).emit(body)
                res.writeHead(200);
                res.end();
            });
        }
    }
});

console.log('listening on http://localhost:3000');

server.listen(3000);

// attach Socket.io to our HTTP server
io.listen(server);

// handle incoming connections from clients
io.on("connection", (socket) => {
    console.log(`msg=connected socket_id=${socket.id}`);
    // once a client has connected, we expect to get a ping from them saying what room they want to join
    socket.on('join', function (room) {
        console.log(`msg=joined socket_id=${socket.id} room=room${room}`);
        socket.join(`room${room}`);
    });
    socket.on('disconnected', function () {
        console.log(`msg=disconnected socket_id=${socket.id}`);
    });
    // let server timeout 10secs
    //setTimeout(() => {
    //    socket.disconnect(true);
    //    console.log(socket.connected);
    //}, 10000);
});
