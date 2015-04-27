//Settings
const DEBUG = true;

//Express
var express = require('express');
var app = express();

//Socket.IO
var server = require('http').Server(app);
var io = require('socket.io')(server);

//edit-google-spreadsheet
var Spreadsheet = require('edit-google-spreadsheet');

//Unity socket id
var unitySocket;

//Client namespace
var client = io.of('/client');

//User list
var users = [];

app.set('port', (process.env.PORT || 5000));
app.use(express.static(__dirname + '/public'));

server.listen(app.get('port'), function() {
	console.log('Node app is running at localhost:' + app.get('port'));
});

/* Unity communication */

io.on('connection', function(socket) {
	//Unity connected
	socket.on('unityConnected', function() {
		unitySocket = socket.id;
		ServerLog("Unity connected");
	});

	//Unity disconnected
	socket.on('disconnect', function() {
		if (socket.id == unitySocket) {
			unitySocket = null;
			client.emit('unityDisconnected');
			ServerLog("Unity disconnected");
		}
	});

	//Unity update
	socket.on('unityUpdate', function(data) {
		for (var id in client.connected)
			client.connected[id].volatile.emit('unityUpdate', data);
	});


});

/* Client communication */

client.on('connection', function(socket) {
	//User logs in
	socket.on('login', function(data) {
		users[socket.id] = {
			'name': data.name,
			'email': data.email
		};
		if (users[socket.id].name != '')
			socket.broadcast.emit('chat', {
				'name': null,
				'message': users[socket.id].name + ' entered the room.'
			});
		else
			socket.broadcast.emit('chat', {
				'name': null,
				'message': 'Anonymous entered the room.'
			});
	});
	//User logs out / disconnects
	socket.on('disconnect', function() {
		if (socket.id in users) {
			if (users[socket.id].name != '')
				client.emit('chat', {
					'name': null,
					'message': users[socket.id].name + ' has left.'
				});
			else
				client.emit('chat', {
					'name': null,
					'message': 'Anonymous user has left.'
				});
			delete users[socket.id];
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