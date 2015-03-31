//Express
var express = require('express');
var app = express();

//Socket.IO
var server = require('http').Server(app);
var io = require('socket.io')(server);

//Unity namespace
var unity = io.of('/unity');
//Unity socket
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

unity.on('connection', function(socket) {
	//Unity connected
	socket.on('unityConnected', function() {
		unitySocket = socket;
		unity.emit('unityConnected');
	});

	//Unity disconnected
	socket.on('disconnect', function() {
		if (socket == unitySocket) {
			unitySocket = null;
			unity.emit('unityDisconnected');
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
	socket.on('login', function(name, email) {
		users[socket] = {
			'name': name,
			'email': email
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
			console.error('Error: disconnected user is not in the user list.')
	});
	//Chat message
	socket.on('chat', function(data) {
		client.emit('chat', data);
	});

	//Add blob
	socket.on('addBlob', function(data) {
		unity.emit("addBlob", data);
	});
});