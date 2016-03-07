var express = require('express');
var router = express.Router();
var https = require('https');
var Firebase = require("firebase");
var myFirebaseRef = new Firebase("https://spell-to.firebaseio.com/");
var moment = require('moment');

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
		var user_chat_id = req_payload.source + '|' + req_payload.user_id + '|' + req_payload.chat_id;
		console.log('User chat ID: ' + user_chat_id);
		myFirebaseRef.child('user_chats/active/' + user_chat_id).once('value', function(data) {
			var active_spell = data.val();
			console.log('Active Spell: ' + data.val());
		  	if (active_spell === undefined || active_spell === null) {
			    //create a new spell if command is valid
			    var message = req_payload.text;
			    myFirebaseRef.child("spells/" + message).once("value", function(data) {
			    	var spell = data.val();
			    	if (spell === undefined || spell === null) {
			    		//Invalid spell, reply back as invalid
			    		console.log('Invalid Spell requested: ' + message);
			    		respond_to_bot(req_payload.source, req_payload.chat_id, 'Sorry, incorrect Spell!');
			    	} else {
			    		//Valid Spell, Start new active spell for the user chat.
			    		console.log('Valid Spell: ' + JSON.stringify(spell));
			    		myFirebaseRef.child('user_chats/active/' + user_chat_id).set({
						  spell: message,
						  start_time: (new Date()).getTime()
						});
						//Check if spell has more options
						if(spell.options === undefined || spell.options === null) {
							//End Spell
							end_spell(user_chat_id, spell, true);
						} else {
							//Process options
							//TODO
						}
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
	  console.log('Bot Send API response status code: ', response.statusCode);
	});
	bot_send.on('error', function(e) {
	  console.error(e);
	});
	bot_send.write(payload);
	bot_send.end();
	//End: Respond to Bot Send Method
};

function end_spell(user_chat_id, spell, call_outgoing_webhook) {
	//Get the spell from firebase
	myFirebaseRef.child('user_chats/active/' + user_chat_id).once('value', function(data) {
		var active_spell = data.val();
		if(active_spell === undefined || active_spell === null){
			//Nothing to do, if no active spell!
			console.log('Wondering how to end a spell that is no there!');
		} else {
			//Close the active spell
			myFirebaseRef.child('user_chats/active/' + user_chat_id).remove(function(error) {
				if (error) {
			  		console.log('Removal failed: ' + user_chat_id);
			  	} else {
			  		console.log('Removed active spell: ' + user_chat_id);
			    	//Create an old entry
			    	var old_spell = active_spell;
			    	old_spell.end_time = (new Date).getTime();
			    	var formattedDate = moment(new Date()).format('YYYYMMDD');
				    myFirebaseRef.child('user_chats/old/' + formattedDate).push(old_spell, function(error) {
				  		if (error) {
				    		console.log('Archive failed: ' + user_chat_id);
				  		} else {
				  			console.log('Successfully archived: ' + user_chat_id);
				  			if(call_outgoing_webhook) {
				  				//Call Outgoing Webhook
				  				console.log('Going to make request to outgoing webhook: ' + JSON.stringify(active_spell));
				  				console.log('Spell definition: ' + JSON.stringify(spell));
				  				//TODO
				  			}
				  		}
					});
				}
			});
		}
	});
};

module.exports = router;