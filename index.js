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
var dataSheet;
var loginCount = 0;

//Email spreadsheet structure
const EMAIL_COL = {
	NAME: 1,
	EMAIL: 2,
	TIME: 3
}

//Data spreadsheet structure
const DATA_COL = {
	DATE: 1,
	TIME: 2,
	ID: 3,
	LOGIN: 4,
	POPS: 5,
	DISTANCE: 6,
	RUNTIME_RAW: 7,
	RUNTIME: 8
}


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
		UpdateAnalytics(data, socket.id);
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
	if (DEBUG)
		console.log(newRow);
	sheet.send({ autoSize: true }, function(err) {
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
				if (rows[row][EMAIL_COL.EMAIL] == data.email) {
					emailFound = true;
					var newData = {};
					newData[EMAIL_COL.TIME] = moment().tz("America/New_York").format("MMM Do YYYY, h:mm:ss a");
					AddData(emailSheet, rowCount, newData, AddLoginCount);
				}
			}
			if (!emailFound) {
				var newData = {};
				newData[EMAIL_COL.NAME] = data.name;
				newData[EMAIL_COL.EMAIL] = data.email;
				newData[EMAIL_COL.TIME] = moment().tz("America/New_York").format("MMM Do YYYY, h:mm:ss a");
				AddData(emailSheet, rowCount + 1, newData, AddLoginCount);
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
				if (rows[row][DATA_COL.DATE] == moment().tz("America/New_York").format("l") && !todayFound) {
					//Found today
					todayFound = true;
					if (parseInt(rows[row][DATA_COL.LOGIN]) > loginCount)
						loginCount = parseInt(rows[row][DATA_COL.LOGIN]) + 1;
					var newData = {};
					newData[DATA_COL.LOGIN] = loginCount;
					AddData(dataSheet, rowCount, newData);
				}
			}
			if (!todayFound) {
				//First log of today
				loginCount = 1;
				var newData = {};
				newData[DATA_COL.DATE] = moment().tz("America/New_York").format("l");
				newData[DATA_COL.LOGIN] = loginCount;
				AddData(dataSheet, rowCount + 1, newData)
			}
		});
	}
	else {
		LoadDataSheet(AddLoginCount);
	}
}

function UpdateAnalytics(data, id) {
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
					if (rows[row][DATA_COL.DATE] == moment().tz("America/New_York").format("l")) {
						//Found today
						dateFound = true;
						if (rows[row][DATA_COL.ID] == id || rows[row][DATA_COL.ID] == "" || rows[row][DATA_COL.ID] == null) {
							//Session found
							sessionFound = true;
							var newData = {};
							if (rows[row][DATA_COL.TIME] == "" || rows[row][DATA_COL.TIME] == null)
								newData[DATA_COL.TIME] = moment().tz("America/New_York").format("l");
							newData[DATA_COL.ID] = id;
							newData[DATA_COL.POPS] = data.pops;
							newData[DATA_COL.DISTANCE] = data.distance;
							newData[DATA_COL.RUNTIME_RAW] = data.time;
							newData[DATA_COL.RUNTIME] = moment().startOf('day').seconds(data.time).format('H:mm:ss');
							AddData(dataSheet, rowCount, newData);
						}
					}
				}
				if (!sessionFound) {
					//First log of this session
					var newData = {};
					newData[DATA_COL.DATE] = moment().tz("America/New_York").format("l");
					newData[DATA_COL.TIME] = moment().tz("America/New_York").format("LTS");
					newData[DATA_COL.ID] = id;
					newData[DATA_COL.POPS] = data.pops;
					newData[DATA_COL.DISTANCE] = data.distance;
					newData[DATA_COL.RUNTIME_RAW] = data.time;
					newData[DATA_COL.RUNTIME] = moment().startOf('day').seconds(data.time).format('H:mm:ss');
					AddData(dataSheet, rowCount + 1, newData);
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