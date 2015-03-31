// Play4Life mobile client engine
var username = "";
var email = "";
var fieldCompleted = false;
var socket = io.connect('/client');
//Main
$(document).ready(function() {
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
	//on chat data recevied
	socket.on('chat', function(data){
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
});
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