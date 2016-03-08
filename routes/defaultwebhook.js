var express = require('express');
var router = express.Router();
var https = require('https');
var Firebase = require("firebase");
var myFirebaseRef = new Firebase("https://spell-to.firebaseio.com/");
var firebase_secret = process.env.FIREBASE_SECRET;
myFirebaseRef.authWithCustomToken(firebase_secret, function(error, authData) {
  	if (error) {
    	console.log("Firebase authentication Failed!", error);
  	} else {
    	console.log("Firebase authenticated successfully with payload:", authData);
  	}
});

var vendor_telegram_token = process.env.VENDOR_TELEGRAM_TOKEN;
var my_token = process.env.DEFAULT_WEBHOOK_TOKEN;
var vendor_telegram_host_url = process.env.VENDOR_TELEGRAM_HOST_URL;
var default_webhook_url = process.env.DEFAULT_WEBHOOK_URL;

//Register Vendor
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
router.post('/registervendor/:token', function(req, res) {

	var token = req.params.token;
	var req_payload = req.body;
	
	console.log('Vendor register request received by DefaultWebhook: ' + JSON.stringify(req_payload));

	//Authenticate token
	if(token === my_token) {
		//Check if any active spell for the user chat
		var user_chat_id = req_payload.source + '|' + req_payload.user_id + '|' + req_payload.chat_id;
		console.log('User chat ID: ' + user_chat_id);
		//Check if the spell and token matches in the message
		var text_keys = req_payload.text.split(' ');
		if(text_keys.length === 2) {
			var spell = text_keys[0];
			var webhook_token = text_keys[1];
			myFirebaseRef.child('spells/' + spell).once('value', function(data) { 
				var spell_definition = data.val();
				if(spell_definition === undefined || spell_definition === null) {
					//Respond saying unexpected command. Type <spell> <token> to register for Vendor Bot.
					respond_to_vendor_bot(req_payload.source, req_payload.chat_id, 'Unexpected command. Type <spell> <token> to register for Vendor Bot.');
				} else {
					if( (spell_definition.webhook_token === webhook_token) && (spell_definition.webhook === 'default_webhook_url' + '/api/defaultwebhook/' ) ) {
						//Register
						var default_destination = {source: req_payload.source, user_id: req_payload.user_id, chat_id: req_payload.chat_id, created_time: (new Date()).getTime()};
						myFirebaseRef.child('default_destinations/' + spell).set(default_destination, function(error) {
							if(error){
			    				console.log('Failed while saving default destination');
			    			} else {
			    				console.log('Saved default destination: ' + JSON.stringify(default_destination) + '. For spell: ' + spell);
			    				//Respond saying successfull set up the vendor
								respond_to_vendor_bot(req_payload.source, req_payload.chat_id, 'You are successfully set up!');
			    			}
						});
					} else {
						respond_to_vendor_bot(req_payload.source, req_payload.chat_id, 'Unexpected token. Type <spell> <token> to register for Vendor Bot.');
					}
				}
			});
		} else {
			respond_to_vendor_bot(req_payload.source, req_payload.chat_id, 'Unexpected command. Type <spell> <token> to register for Vendor Bot.');
		}
		res.status(200).end();
	} else {
		console.log('Token mismatch');
		res.status(400).end();
	}
});

function respond_to_vendor_bot(source, chat_id, message) {
	if(source === 'telegram') {
		var vendor_host_url = vendor_telegram_host_url;
		var vendor_path = 'vendortelegram';
		var vendor_token = vendor_telegram_token;
	}
	//Start: Send Message to Vendor Telegram API
	var d = {
		chat_id: chat_id,
		text: message
	};
	var payload = JSON.stringify(d);
	console.log('Payload to Vendor Bot: ' + payload);

	var options = {
	  hostname: vendor_host_url,
	  path: '/api/'+vendor_path+ '/send' + vendor_token,
	  method: 'POST',
	  headers: {
	  	'Content-Type': 'application/json',
	  	'Content-Length': payload.length
	  }
	};

	var vendorbot_api_req = https.request(options, function(response) {
	  console.log("Vendor Bot API response status code: ", response.statusCode);
	});
	vendorbot_api_req.on('error', function(e) {
	  console.error(e);
	});
	vendorbot_api_req.write(payload);
	vendorbot_api_req.end();
	//End: Send Message to Vendor Telegram API
};

//Main Default Webhook
router.post('/:token', function(req, res) {

	var token = req.params.token;
	var req_payload = req.body;
	
	console.log('Request received by Default Webhook: ' + JSON.stringify(req_payload));

	//Authenticate token
	if(token === my_token) {
		//Acknowledge the right chat about the request
		//TODO
		res.status(200).end();
	} else {
		console.log('Token mismatch');
		res.status(400).end();
	}
});

module.exports = router;