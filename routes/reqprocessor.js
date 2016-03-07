var express = require('express');
var router = express.Router();
var https = require('https');
var Firebase = require("firebase");
var myFirebaseRef = new Firebase("https://spell-to.firebaseio.com/");

var telegram_token = process.env.TELEGRAM_TOKEN;
var my_token = process.env.REQPROCESSOR_TOKEN;
var telegram_host_url = process.env.TELEGRAM_HOST_URL;

//Request will be sent by bots
/* Payload example:
{
	source: 'telegram',
	update_id: update_id,
	user_id: message.from.id,
	user_name: message.from.first_name, 
	timestamp: message.date,
	chat_id: message.chat.id,
	text: message.text
}
*/
router.post('/:token', function(req, res) {

	var token = req.params.token;
	var req_payload = req.body;
	
	console.log('Request received by ReqProcessor: ' + JSON.stringify(req_payload));

	//Authenticate token
	if(token === my_token) {
		//TODO Logic
		//Check if any active spell for the user chat
		var user_chat_id = req_payload.source + req_payload.user_id + req_payload.chat_id;
		console.log('User chat ID: ' + user_chat_id);
		myFirebaseRef.child("user_chats/active/" + user_chat_id).once("value", function(data) {
			var active_spell = data.val();
			console.log('Active Spell: ' + data.val());
		  	if (active_spell === undefined || active_spell === null) {
			    //create a new spell if command is valid
			    var message = req_payload.text;
			    myFirebaseRef.child("spells/" + message).once("value", function(data) {
			    	var spell = data.val();
			    	if (spell === undefined || spell === null) {
			    		//Invalid spell, reply back as invalid
			    		respond_to_bot(req_payload.source, req_payload.chat_id, 'Sorry, incorrect Spell!');
			    	} else {
			    		//Start the spell.
			    		//TODO
			    	}
			    });
			} else {
				//check if valid option
				//TODO
			}
		});


		res.status(200).end();
	} else {
		console.log('Token mismatch');

		res.status(400).end();
	}
});

function respond_to_bot(source, chat_id, message) {

	var bot_hostname;
	if(source === 'telegram') {
		bot_hostname =  telegram_host_url;
		token = telegram_token;
	} else {
		console.log('Unknown source to respond.');
	}

	//Start: Respond to Bot Send Method
	var d = {
		text: message,
		chat_id: chat_id,
	};
	var payload = JSON.stringify(d);
	console.log('Payload to bot respond method: ' + payload);

	var options = {
	  hostname: bot_hostname,
	  path: '/api/' + source + '/send/' + token,
	  method: 'POST',
	  headers: {
	  	'Content-Type': 'application/json',
	  	'Content-Length': payload.length
	  }
	};

	var bot_send = https.request(options, function(response) {
	  console.log("Bot Send API response status code: ", response.statusCode);
	});
	bot_send.on('error', function(e) {
	  console.error(e);
	});
	bot_send.write(payload);
	bot_send.end();
	//End: Respond to Bot Send Method

};

module.exports = router;