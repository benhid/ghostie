# 👻.link

Use ghostie to receive desktop notifications when any command finishes.

Grab an url or use your own (tip: generate a random url to reduce discoverability) to get started:

```console
$ echo $(curl -sL https://ghostie.link)
https://ghostie.link/...
```

## How it works

ghostie establish a WebSocket connection between the server and the client via [socket.io](https://socket.io). 
Submitted notifications (POSTed) are then broadcasted to all connected clients and shown in the browser. 

If the user granted permission, a desktop notification is displayed using the [Notification API](https://developer.mozilla.org/es/docs/Web/API/notification).

## Run locally

Clone the repository and run the following commands:

Using node:

```console
$ npm i
$ npm start
```

Using Docker:

```console
$ docker build -t benhid/ghostie .
$ docker run -p 3000:3000 benhid/ghostie
```

## License

This project is licensed under the MIT license. See the [LICENSE](LICENSE) file for more info.
