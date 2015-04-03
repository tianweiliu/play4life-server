// Play4Life mobile client engine

const BLOB_TYPE = {
	RED: "Taylor",
	BLUE: "HandsomeGuy",
	YELLOW: "Bob",
	GREEN: "Green",
	PURPLE: "Purple",
	ORANGE: "Orange",
	BLACK: "Black"
}

var username = "";
var email = "";
var fieldCompleted = false;
var loggedIn = false;
var socket = io.connect('/client');
//Main
$(document).ready(function() {
	
	$.each(BLOB_TYPE, function(index, blobType) {
		$("#controlPanel #blobs").append($("<li></li>").attr("id", blobType).addClass("blobBtn").append($("<div></div").css({
			"background": "url('images/blobs/" + blobType + ".png') no-repeat",
			"background-size": "contain"
		})));
	});
	
	onResize();
	$(window).on('resize', onResize);
	
	$('#name').bind('input propertychange', function() {
        checkInputFields(); 
    });
	$('#email').bind('input propertychange', function() {
        checkInputFields();
    });
	$('#login').submit(function() {
		if (!fieldCompleted)
		  return false
		doLogin();
		return false;
	});
	$("#anonymous a").click(function(e) {
		e.preventDefault();
		doLogin(true);
	});
	$('#chat').submit(function(){
		var msg = $('#m').val();
		if (msg != "chat" && msg != "") {
		  socket.emit('chat', {
			name: username,
			message: $('#m').val()
		  });
		}
		$('#m').val('');
		return false;
	});
	
	//canvas preparation
	var canvas = $("#stage").get(0);
	var context = canvas.getContext('2d');
	context.translate(0.5, 0.5);
	
	// mouse events
	var isDown = false;     //flag we use to keep track if mouse button is down
	var selectedBlob = "";
	var blobType;
	var x1, y1, x2, y2;     //to store the coords
	
	$("#stage").on('mousedown', function(e){
		var pos = getMousePos(canvas, e);
		spawnBlob("", pos.x, pos.y);
	});
	
	//on unityUpdate
	socket.on('unityUpdate', function(data){
		if (!loggedIn)
			return;
		$("#stage").show();
		$("#blobs").show();
		$("#offline").hide();
		onResize();
		context.clearRect(0, 0, canvas.width, canvas.height);
		var img = $("#canvasImg").get(0);
	    context.drawImage(img, 0, 0, canvas.width, canvas.height);
		var stageW = data.width;
		var stageH = data.height;
		var radius = 40;
		$.each(data.players, function(index, player) {
			var xPos = canvas.width * (.5 + player.x / stageW * .5);
			var yPos = canvas.height * (.5 - player.y / stageH * .5);
			context.beginPath();
			context.arc(xPos, yPos, radius, 0, 2 * Math.PI, false);
			context.fillStyle = rgbToHex(Math.floor(player.color.r * 255), Math.floor(player.color.g * 255), Math.floor(player.color.b * 255));
			context.fill();
			context.lineWidth = 5;
			context.strokeStyle = '#000';
			context.stroke();
			context.closePath();
		});
		$.each(data.blobs, function(index, blob) {
			var xPos = canvas.width * (.5 + blob.x / stageW * .5);
			var yPos = canvas.height * (.5 - blob.y / stageH * .5);
			context.beginPath();
			context.arc(xPos, yPos, radius, 0, 2 * Math.PI, false);
			context.fillStyle = rgbToHex(Math.floor(blob.color.r * 255), Math.floor(blob.color.g * 255), Math.floor(blob.color.b * 255));
			context.fill();
			context.lineWidth = 5;
			context.strokeStyle = '#fff';
			context.stroke();
			context.closePath();
		});
	});
	
	//on chat data recevied
	socket.on('chat', function(data){
		if (!loggedIn)
			return;
		if (data.name == null) {
		  $('#messages').append($('<li>').html('<strong>' + data.message + '</strong>'));
		}
		else {
			var nickname = "Anonymous";
			if (data.name != "")
			  nickname = data.name;
			$('#messages').append($('<li>').html('<span class="name">' + nickname + '</span>:&nbsp;' + data.message));
		}
	}); 
	
	//on unity disconnected
	socket.on('unityDisconnected', function() {
		if (!loggedIn)
			return;
		$("#stage").hide();
		$("#blobs").hide();
		$("#offline").show();
	});
});
//on resize
function onResize() {
	var blobTypeCount = 0;
	$.each(BLOB_TYPE, function(index, blobType) {
		blobTypeCount++;
	});
	if ($(window).height() <= $(window).width()) {
		//Landscape mode
		var stageSize = $(window).height() - 74;
		$("#stage").height(stageSize).css("width", ""); 
		$("#offline").width(stageSize).height(stageSize);
		$("#controlPanel").width($(window).width() - 30 - stageSize).height(stageSize).css("margin-left", "10px").css("margin-top", "");
		var btnSize = $("#controlPanel").height() / blobTypeCount - 12;
		$("#controlPanel #blobs li").height(btnSize).width(btnSize).css("float", "");
		$("#controlPanel #blobs").width(btnSize).css("float", "left");
		$("#messagePanel").height($("#controlPanel").height()).width($("#controlPanel").width() - 20 - btnSize).css({
			"float": "right",
			"margin-top": ""
		});
		$("#messages").width($("#controlPanel").width() - 20 - btnSize);
	}
	else {
		//Portrait mode
		var stageSize = $(window).width() - 20;
		$("#stage").width(stageSize).css("height", ""); 
		$("#offline").width(stageSize).height(stageSize);
		$("#controlPanel").width($(window).width() - 20).height($(window).height() - 84 - stageSize).css("margin-left", "").css("margin-top", "10px");
		var btnSize = $("#controlPanel").width() / blobTypeCount - 14;
		$("#controlPanel #blobs li").height(btnSize).width(btnSize).css("float", "left");
		$("#controlPanel #blobs").width($("#controlPanel").width()).css("float", "");
		$("#messagePanel").height($("#controlPanel").height() - 20 - btnSize).width($("#controlPanel").width()).css({
			"float": "left",
			"margin-top": "5px"
		});
		$("#messages").width($("#controlPanel").width());
	}
}
//login function
function doLogin(anonymous) {
	if (!anonymous) {
	 username = $("#name").val();
	 email = $("#email").val();
	}
	socket.emit('login', {
	  name: username,
	  email: email
	});
	$("#loginPanel").hide();
	$("#chatPanel").show();
	$("#stagePanel").show();
	loggedIn = true;
}
//check input fields
function checkInputFields() {
	if (
		$("#name").val() == "" ||
		$("#name").val() == "nickname" ||
		$("#email").val() == "" ||
		$("#email").val() == "e-mail address"
	) {
	  fieldCompleted = false;
	}
	else
	fieldCompleted = true;
	setEnterEnabled();
}

//set enter button enabled
function setEnterEnabled() {
	if (fieldCompleted) {
	  $("#login input[type='submit']").removeClass("disabled");
	}
	else {
	  $("#login input[type='submit']").addClass("disabled");
	}
}

function componentToHex(c) {
    var hex = c.toString(16);
    return hex.length == 1 ? "0" + hex : hex;
}

function rgbToHex(r, g, b) {
    return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

// get mouse pos relative to canvas (yours is fine, this is just different)
function getMousePos(canvas, evt) {
	var rect = canvas.getBoundingClientRect();
	return {
		x: evt.clientX - rect.left,
		y: evt.clientY - rect.top
	};
}

// spawn blob
function spawnBlob(blobType, x, y) {
	socket.emit("addBlob", {
		"blobType": blobType,
		"x": x / $("#stage").width() - .5,
		"y": .5 - y / $("#stage").height()
	});
}