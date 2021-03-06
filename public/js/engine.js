// Play4Life mobile client engine

const BLOB_TYPE = {
	RED: "Taylor",
	BLUE: "HandsomeGuy",
	YELLOW: "Bob",
	PURPLE: "Purple"
	/*
	GREEN: "Green",
	ORANGE: "Orange",
	BLACK: "Black"
	*/
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
		}).draggable({
			start: function(event, ui) {
				
			},
			stop: function(event, ui) {
				var rect = $("#stage").get(0).getBoundingClientRect();
				
				var posX = ui.position.left + $(this).width() / 2 + $(this).parent("li").position().left - rect.left;
				var posY = ui.position.top + $(this).height() / 2 + $(this).parent("li").position().top - rect.top;
				
				if (posX >= 0 && posX <= $("#stage").width() && posY >= 0 && posY <= $("#stage").height())
				{
					spawnBlob($(this).parent("li").attr("id"), posX, posY);
				}
				
				$(this).css({
					left: "",
					top: ""
				});
			}
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
		$.each(data.smallBlobs, function(index, blob) {
			var xPos = canvas.width * (.5 + blob.x / stageW * .5);
			var yPos = canvas.height * (.5 - blob.y / stageH * .5);
			context.beginPath();
			context.arc(xPos, yPos, radius / 2, 0, 2 * Math.PI, false);
			context.fillStyle = rgbToHex(Math.floor(blob.color.r * 255), Math.floor(blob.color.g * 255), Math.floor(blob.color.b * 255));
			context.fill();
			context.lineWidth = 5;
			context.strokeStyle = '#fff';
			context.stroke();
			context.closePath();
		});
	});
	
	//on analytics update
	socket.on('analyticsUpdate', function(data){
		if (!loggedIn)
			return;
		$("#data").show();
		$("#pops span").text(data.pops);
		$("#distance span").text(parseFloat(data.distance).toFixed(3));
	});
	
	//on chat data recevied
	socket.on('chat', function(data){
		if (!loggedIn)
			return;
		if (data.name == null) {
		  $('#messages').append($('<li>').append($('<strong></strong>').text(data.message)));
		}
		else {
			var nickname = "Anonymous";
			if (data.name != "")
			  nickname = data.name;
			$('#messages').append($('<li>').append($('<span class="name"></span>').text(nickname + ": ")).append($('<span></span>').text(data.message)));
		}
	}); 
	
	//on unity disconnected
	socket.on('unityDisconnected', function() {
		if (!loggedIn)
			return;
		$("#stage").hide();
		$("#blobs").hide();
		$("#data").hide();
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
		var stageSize = $(window).height() - 35;
		$("#stage").height(stageSize).css("width", ""); 
		$("#data").width(stageSize).css({
			"font-size": stageSize * .04 + "px",
			"line-height": stageSize * .045 + "px"
		});
		$("#offline").width(stageSize).height(stageSize);
		$("#controlPanel").width($(window).width() - 30 - stageSize).height(stageSize).css("margin-left", "10px").css("margin-top", "");
		var btnSize = $("#controlPanel").height() / blobTypeCount - 12;
		if ($(window).width() - 40 - stageSize < btnSize)
			btnSize = $(window).width() - 40 - stageSize;
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
		$("#data").width(stageSize).css({
			"font-size": stageSize * .04 + "px",
			"line-height": stageSize * .045 + "px"
		});
		$("#offline").width(stageSize).height(stageSize);
		$("#controlPanel").width($(window).width() - 20).height($(window).height() - 84 - stageSize).css("margin-left", "").css("margin-top", "10px");
		var btnSize = $("#controlPanel").width() / blobTypeCount - 14;
		if ($(window).height() - 40 - stageSize < btnSize)
			btnSize = $(window).height() - 74 - stageSize;
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
	//$("#chatPanel").show();
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