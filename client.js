var sharedb = require('sharedb/lib/client');
var richText = require('rich-text');
var Quill = require('quill');
// var ColorClass = Quill.import('attributors/class/color');
// var SizeStyle = Quill.import('attributors/style/size');
// Quill.register(ColorClass, true);
// Quill.register(SizeStyle, true);
sharedb.types.register(richText.type);

// Open WebSocket connection to ShareDB server
var socket = new WebSocket('ws://' + window.location.host);
var connection = new sharedb.Connection(socket);

// For testing reconnection
window.disconnect = function() {
  connection.close();
};
window.connect = function() {
  var socket = new WebSocket('ws://' + window.location.host);
  connection.bindToSocket(socket);
};

// Create local Doc instance mapped to 'examples' collection document with id 'richtext'
var doc = connection.get('examples', 'richtext');
doc.subscribe(function(err) {
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
  quill.on('text-change', function(delta, oldDelta, source) {
    if (source !== 'user') return;
    let d = new Date();
    console.log(d.getSeconds()+JSON.stringify(delta));
    let len = delta.ops.length;
    let second = delta.ops[len-1];
    if(second.insert === 'n'){
      // here try to history undo
      quill.history.undo();
    } else {
      doc.submitOp(delta, {source: quill});
    }
  });
  doc.on('op', function(op, source) {
    if (source === quill) return;
    quill.updateContents(op);
  });
});
