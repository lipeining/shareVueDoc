var http = require('http');
var express = require('express');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var session = require('express-session');
var ShareDB = require('sharedb');
var richText = require('rich-text');
var WebSocket = require('ws');
var WebSocketJSONStream = require('websocket-json-stream');

ShareDB.types.register(richText.type);
var backend = new ShareDB();
createDoc(startServer);

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

function startServer() {
  // Create a web server to serve files and listen to WebSocket connections
  var app = express();
  app.use(session({
    secret: 'wow_doc',
    resave: true,
    saveUninitialized: true,
    cookie: {
      maxAge: 6000000
    } //100 min
  }));
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
    console.log('%s %s', req.method, req.url);
    if (req.session) {
      console.log(req.session);
    } else {
      console.log('no req.session');
    }
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

  // Connect any incoming WebSocket connection to ShareDB
  var wss = new WebSocket.Server({
    server: server
  });
  wss.on('connection', function (ws, req) {
    var stream = new WebSocketJSONStream(ws);
    backend.listen(stream);
  });

  server.listen(5000);
  console.log('Listening on http://localhost:5000');
}