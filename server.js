var http = require('http');
var express = require('express');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var session = require('express-session');
var ShareDB = require('sharedb');
var richText = require('rich-text');
var WebSocket = require('ws');
var WebSocketJSONStream = require('websocket-json-stream');
var url = require('url');
var uuid = require('uuid/v4');
var debugShare = require('debug')('sharedb');
var debugTTT = require('debug')('TTT');
ShareDB.types.register(richText.type);
var backend = new ShareDB();
createDoc(startServer);
var sessionParser = session({
  secret: 'wow_doc',
  resave: true,
  saveUninitialized: true,
  cookie: {
    maxAge: 6000000
  } //100 min
});
// Create initial document then fire callback
function createDoc(callback) {
  var connection = backend.connect();
  var doc = connection.get('examples', 'richtext');
  doc.fetch(function (err) {
    if (err) throw err;
    if (doc.type === null) {
      doc.create([{
        insert: 'Hi!'
      }], 'rich-text', callback);
      return;
    }
    callback();
  });
}

const wssSharedb = new WebSocket.Server({
  noServer: true
});
const wssTTT = new WebSocket.Server({
  verifyClient: (info, done) => {
    console.log('Parsing session from request...');
    sessionParser(info.req, {}, () => {
      console.log('Session is parsed!');

      //
      // We can reject the connection by returning false to done(). For example,
      // reject here if user is unknown.
      //
      done(info.req.session);
    });
  },
  noServer: true
});

wssSharedb.on('connection', function connection(ws, req) {
  // ...
  // generate an id for the socket
  ws.id = uuid();
  ws.isAlive = true;
  var stream = new WebSocketJSONStream(ws);
  backend.listen(stream);
  ws.on('pong', function (data, flags) {
    debugShare('sharedb Pong received. (%s)', ws.id);
    ws.isAlive = true;
  });

  ws.on('error', function (error) {
    debugShare('sharedb Client connection errored (%s). (Error: %s)', ws.id, error);
  });
});

// Sockets Ping, Keep Alive sharedb
setInterval(function () {
  // debugTTT('interval sharedb ping');
  // console.log('interval sharedb ping');
  wssSharedb.clients.forEach(function (ws) {
    if (ws.isAlive === false) return ws.terminate();

    ws.isAlive = false;
    ws.ping();
    debugShare('sharedb Ping sent. (%s)', ws.id);
  });
}, 30000);

wssTTT.on('connection', function connection(ws, req) {
  // ...
  // generate an id for the socket
  ws.id = uuid();
  ws.isAlive = true;
  ws.on('pong', function (data, flags) {
    debugTTT('ttt Pong received. (%s)', ws.id);
    ws.isAlive = true;
  });

  ws.on('error', function (error) {
    debugTTT('ttt Client connection errored (%s). (Error: %s)', ws.id, error);
  });
  console.log('on connection to get the req.session');
  console.log(req.session);
  // 我们可以修改对应的session。可以读取之。
  ws.on('message', function (message) {
    if (message === 'wow') {
      // do nothing
      console.log(`WS test message ${message} from user ${req.session.user}`);
      console.log(req.session.user);
    } else {
      // Here we can now use session parameters.
      console.log(`WS message ${message} from user ${req.session.user}`);
      console.log(req.session.user);
      // try to reset the session
      req.session.user = {
        id: 2,
        name: 'duoyi'
      };
      req.session.save();
      ws.send('server to client ttt');
    }
  });
});
// Sockets Ping, Keep Alive ttt
setInterval(function () {
  // debugTTT('interval ttt ping');
  // console.log('interval ttt ping');
  wssTTT.clients.forEach(function (ws) {
    if (ws.isAlive === false) return ws.terminate();

    ws.isAlive = false;
    ws.ping();
    debugTTT('ttt Ping sent. (%s)', ws.id);
  });
}, 30000);

function startServer() {
  // Create a web server to serve files and listen to WebSocket connections
  var app = express();

  app.use(sessionParser);
  app.use(logger('dev'));
  app.use(express.json());
  app.use(express.urlencoded({
    extended: false
  }));
  app.use(cookieParser());
  app.use(express.static('static'));
  app.use(express.static('node_modules/quill/dist'));
  // 一个简单的 logger
  app.use(function (req, res, next) {
    console.log('simple logger %s %s', req.method, req.url);
    // if (req.session) {
    //   console.log(req.session);
    // } else {
    //   console.log('no req.session');
    // }
    next();
  });
  app.get('/login', function (req, res, next) {
    req.session.user = {
      id: 1,
      name: 'wow'
    };
    return res.json({
      code: 0,
      Message: {
        login: 'wow'
      }
    });
  });
  app.get('/test', function (req, res, next) {
    return res.json({
      code: 0,
      Message: req.session.user
    });
  });
  app.get('/logout', (request, response) => {
    console.log('Destroying session');
    request.session.destroy();
    response.send({
      result: 'OK',
      message: 'Session destroyed'
    });
  });
  // error handler
  app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 404);
    return res.json({
      code: 4,
      Message: {
        err: 'not found'
      }
    });
    // res.render('error');
  });
  var server = http.createServer(app);

  server.on('upgrade', function upgrade(request, socket, head) {
    const pathname = url.parse(request.url).pathname;

    if (pathname === '/sharedb') {
      wssSharedb.handleUpgrade(request, socket, head, function done(ws) {
        wssSharedb.emit('connection', ws, request);
      });
    } else if (pathname === '/ttt') {
      wssTTT.handleUpgrade(request, socket, head, function done(ws) {
        wssTTT.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  // Connect any incoming WebSocket connection to ShareDB
  // var wss = new WebSocket.Server({
  //     verifyClient: (info, done) => {
  //       console.log('Parsing session from request...');
  //       sessionParser(info.req, {}, () => {
  //         console.log('Session is parsed!');

  //         //
  //         // We can reject the connection by returning false to done(). For example,
  //         // reject here if user is unknown.
  //         //
  //         done(info.req.session);
  //       });
  //     },
  //     server
  // });
  // var wss = new WebSocket.Server({
  //   server: server
  // });
  // wss.on('connection', function (ws, req) {
  //   console.log('on connection to get the req.session');
  //   console.log(req);
  //   var stream = new WebSocketJSONStream(ws);
  //   backend.listen(stream);
  //   ws.on('message',  function(message){
  //   // Here we can now use session parameters.
  //   console.log(`WS message ${message} from user ${req.session.user}`);
  //   });
  // });

  server.listen(5000);
  console.log('Listening on http://localhost:5000');
}