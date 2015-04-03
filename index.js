//Settings
const DEBUG = true;

//Express
var express = require('express');
var app = express();

//Socket.IO
var server = require('http').Server(app);
var io = require('socket.io')(server);

//Unity socket
var unitySocket;

//Client namespace
var client = io.of('/client');

//User list
var users = [];

app.set('port', (process.env.PORT || 5000));
app.use(express.static(__dirname + '/public'));

app.use(function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  return next();
});

server.listen(app.get('port'), function() {
	console.log('Node app is running at localhost:' + app.get('port'));
});

/* Unity communication */

io.on('connection', function(socket) {
	//Unity connected
	socket.on('unityConnected', function() {
		unitySocket = socket;
		ServerLog("Unity connected");
	});

	//Unity disconnected
	socket.on('disconnect', function() {
		if (socket == unitySocket) {
			unitySocket = null;
			client.emit('unityDisconnected');
			ServerLog("Unity disconnected");
		}
	});

	//Unity update
	socket.on('unityUpdate', function(data) {
		client.emit('unityUpdate', data);
	});


});

/* Client communication */

client.on('connection', function(socket) {
	//User logs in
	socket.on('login', function(data) {
		users[socket] = {
			'name': data.name,
			'email': data.email
		};
	});
	//User logs out / disconnects
	socket.on('disconnect', function() {
		if (socket in users) {
			if (users[socket].name != '')
				client.emit('chat', {
					'name': null,
					'message': users[socket].name + ' has left.'
				});
			else
				client.emit('chat', {
					'name': null,
					'message': 'Anonymous user has left.'
				});
			delete users[socket];
		}
		else
			ServerLog('Error: disconnected user is not in the user list.')
	});
	//Chat message
	socket.on('chat', function(data) {
		client.emit('chat', data);
	});

	//Add blob
	socket.on('addBlob', function(data) {
		io.emit("addBlob", data);
	});
});

/* Functions */

function ServerLog(message) {
	var d = new Date();
	var n = d.toTimeString();
	console.log(message + " on " + n);
	if(DEBUG) {
		client.emit('chat', {
			name: null,
			message: message + " on " + n
		});
	}
}