//Settings
const DEBUG = true;

//Express
var express = require('express');
var app = express();

//Socket.IO
var server = require('http').Server(app);
var io = require('socket.io')(server);

//edit-google-spreadsheet
var spreadSheetEmail = require('edit-google-spreadsheet');
var emailSheet;
var spreadSheetData = require('edit-google-spreadsheet');
var sessionId = 0;
var dataSheet;
var loginCount = 0;

//Moment Timezone
var moment = require('moment-timezone');

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
		sessionId++;
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
	
	socket.on('analyticsUpdate', function(data) {
		for (var id in client.connected)
			client.connected[id].volatile.emit('analyticsUpdate', data);
		UpdateAnalytics(data);
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
		if (users[socket.id].name != '') {
			socket.broadcast.emit('chat', {
				'name': null,
				'message': users[socket.id].name + ' entered the room.'
			});
			UpdateEmail(data);
		}
		else {
			socket.broadcast.emit('chat', {
				'name': null,
				'message': 'Anonymous entered the room.'
			});
			AddLoginCount();
		}
			
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

/* Google Spreadsheet */
LoadEmailSheet(LoadDataSheet);

/* Functions */

function AddData(sheet, rowIndex, colData, callback) {
	var newRow = {};
	newRow[rowIndex] = colData;
	sheet.add(newRow);
	sheet.send(function(err) {
		if(err) throw err;
	});
	if (callback != null)
		callback();
}

function LoadEmailSheet(callback, data) {
	//Google spreadsheet for email recording
	spreadSheetEmail.load({
		debug: DEBUG,
		spreadsheetId: '1PJ5PGnVnZSJj5IlhX7UJfvQKU9Up2v4_nlpWDwpDXGY',
		worksheetId: 'od6', //Email sheet id
		
		oauth:{
			email: process.env.DRIVE_USERNAME,
			key: process.env.DRIVE_KEY
		}
	}, function sheetReady(err, spreadsheet) {
		emailSheet = spreadsheet;
		if (callback != null) {
			if (data != null)
				callback(data);
			else
				callback();
		}
	});
}

function UpdateEmail(data) {
	//Update email collection
	if (emailSheet != null) {
		emailSheet.receive(function(err, rows, info) {
			if(err) throw err;
			var rowCount = 0;
			var emailFound = false;
			for (var row in rows) {
				rowCount++;
				if (rows[row][2] == data.email) {
					emailFound = true;
					AddData(emailSheet, rowCount, {
						3: moment().tz("America/New_York").format("MMM Do YYYY, h:mm:ss a")
					}, AddLoginCount);
				}
			}
			if (!emailFound) {
				AddData(emailSheet, rowCount + 1, {
					1: data.name,
					2: data.email,
					3: moment().tz("America/New_York").format("MMM Do YYYY, h:mm:ss a")
				}, AddLoginCount);
			}
		});
	}
	else {
		LoadEmailSheet(UpdateEmail, data);
	}
}

function LoadDataSheet(callback, data) {
	//Google spreadsheet for analytics
	spreadSheetData.load({
		debug: DEBUG,
		spreadsheetId: '1wKKvj0hI-CZFKasl6O-MXBvSnPE-Vyf4O-uzegld77Y',
		worksheetId: 'od6', //Analytics sheet id
		
		oauth:{
			email: process.env.DRIVE_USERNAME,
			key: process.env.DRIVE_KEY
		}
	}, function sheetReady(err, spreadsheet) {
		dataSheet = spreadsheet;
		if (callback != null) {
			if (data != null)
				callback(data);
			else
				callback();
		}
	});
}

function AddLoginCount() {
	//Increase login count
	if (dataSheet != null) {
		loginCount++;
		dataSheet.receive(function(err, rows, info) {
			if(err) throw err;
			var rowCount = 0;
			var todayFound = false;
			for (var row in rows) {
				rowCount++;
				if (rows[row][1] == moment().tz("America/New_York").format("l")) {
					//Found today
					todayFound = true;
					if (parseInt(rows[row][3]) > loginCount)
						loginCount = parseInt(rows[row][3]) + 1;
					AddData(dataSheet, rowCount, {
						3: loginCount
					});
				}
			}
			if (!todayFound) {
				//First log of today
				loginCount = 1;
				AddData(dataSheet, rowCount + 1, {
					1: moment().tz("America/New_York").format("l"),
					3: loginCount
				})
			}
		});
	}
	else {
		LoadDataSheet(AddLoginCount);
	}
}

function UpdateAnalytics(data) {
	//Store analytics data to google spreadsheet only when data.upload == true
	if (data.upload == true) {
		if (dataSheet != null) {
			dataSheet.receive(function(err, rows, info) {
				if(err) throw err;
				var rowCount = 0;
				var sessionFound = false;
				var dateFound = false;
				for (var row in rows) {
					rowCount++;
					if (rows[row][1] == moment().tz("America/New_York").format("l")) {
						//Found today
						dateFound = true;
						if (rows[row][2] == sessionId) {
							//Session found
							sessionFound = true;
							AddData(dataSheet, rowCount, {
								4: data.pops,
								5: data.distance,
								6: data.time,
								7: moment().startOf('day').seconds(data.time).format('H:mm:ss')
							});
						}
					}
				}
				if (!dateFound) {
					//First log of today
					sessionId = 1;
				}
				if (!sessionFound) {
					//First log of this session
					AddData(dataSheet, rowCount + 1, {
						1: moment().tz("America/New_York").format("l"),
						2: sessionId,
						//3 is for login count
						4: data.pops,
						5: data.distance,
						6: data.time,
						7: moment().startOf('day').seconds(data.time).format('H:mm:ss')
					})
				}
			});
		}
		else {
			LoadDataSheet(UpdateAnalytics, data);
		}
	}
}

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