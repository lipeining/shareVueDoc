var sharedb = require('sharedb/lib/client');
var richText = require('rich-text');
var Quill = require('quill');
// var ColorClass = Quill.import('attributors/class/color');
// var SizeStyle = Quill.import('attributors/style/size');
// Quill.register(ColorClass, true);
// Quill.register(SizeStyle, true);
sharedb.types.register(richText.type);
// var WebSocket = require('ws');// no use
// Open WebSocket connection to ShareDB server
var socket = new WebSocket('ws://' + window.location.host + '/sharedb');
var wsttt = new WebSocket('ws://' + window.location.host + '/ttt');
var sharedbConnection = new sharedb.Connection(socket);

// console.log(wsttt);
wsttt.onopen = function open(){
  wsttt.send('on open client send hello');
};
wsttt.onmessage = function incoming(data){
  console.log('wsttt recive a message form server');
  console.log(data);
  wsttt.send('wow');
};
window.wsttt = wsttt;
// For testing reconnection
window.disconnect = function () {
  sharedbConnection.close();
};
window.connect = function () {
  var socket = new WebSocket('ws://' + window.location.host + '/sharedb');
  sharedbConnection.bindToSocket(socket);
};

// Create local Doc instance mapped to 'examples' collection document with id 'richtext'
var doc = sharedbConnection.get('examples', 'richtext');
doc.subscribe(function (err) {
  if (err) throw err;
  // Quill.register(ColorClass, true);
  // Quill.register(SizeStyle, true);
  // 只能在n的十秒之内的进行取消
  // var quill = new Quill('#editor', {
  //   modules: {
  //     history: {
  //       delay: 10000,
  //       maxStack: 500,
  //       userOnly: false,
  //       // userOnly: true
  //     }
  //   },
  //   theme: 'snow'
  // });
  var quill = new Quill('#editor-container', {
    modules: {
      // syntax: true,
      toolbar: '#toolbar-container',
      history: {
        delay: 10000,
        maxStack: 500,
        userOnly: false,
        // userOnly: true
      }
    },
    theme: 'snow'
  });
  quill.setContents(doc.data);
  quill.on('text-change', function (delta, oldDelta, source) {
    if (source !== 'user') return;
    let d = new Date();
    console.log(d.getSeconds() + JSON.stringify(delta));
    let len = delta.ops.length;
    let second = delta.ops[len - 1];
    if (second.insert === 'n') {
      // here try to history undo
      quill.history.undo();
    } else {
      doc.submitOp(delta, {
        source: 'wow'
      });
    }
  });
  doc.on('op', function (op, source) {
    if (source === 'wow') return;
    quill.updateContents(op);
  });
});