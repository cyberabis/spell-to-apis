var express = require('express');
var router = express.Router();
var https = require('https');

var bot_api_token = process.env.BOT_API_TOKEN;
var my_token = process.env.MY_TOKEN;

//RECEIVE MESSAGE METHOD - INVOKED BY TELEGRAM API WEBHOOK
router.post('/receive/:token', function(req, res) {
	var token = req.params.token;
	var update_id = req.body.update_id;
	var message = req.body.message;
	var inline_query = req.body.inline_query;
	var chosen_inline_query = req.body.chosen_inline_query;

	console.log('Received update id: ' + update_id + '. Token: ' + token);
	console.log('Message from: ' + message.from.first_name + '. Chat id: ' + message.chat.id);
	//TODO Authenticate token
	if(token === my_token) {
		//TODO Forward Message to SpellCHat

		res.status(200).end();
	} else {
		console.log('Token mismatch');

		res.status(400).end();
	}

});

//SEND MESSAGE METHOD - INVOKED BY SPELLCHAT
router.post('/send/:token', function(req, res) {
	var token = req.params.token;
	var chat_id = req.body.chat_id;
	var text = req.body.text;

	console.log('Sending text: ' + text + '. Chat id: ' + chat_id);
	console.log('Bot API token: ' + bot_api_token);
	//TODO Authenticate token
	if(token === my_token) {
		//TODO Forward Message to SpellCHat
		//Call Telegram API
		var d = {chat_id: chat_id, text: text};
		var payload = JSON.stringify(d);

		var options = {
		  hostname: 'api.telegram.org',
		  path: '/' + bot_api_token + '/sendMessage',
		  method: 'POST',
		  headers: {
		  	'Content-Type': 'application/json',
		  	'Content-Length': payload.length
		  }
		};

		var t_api_req = https.request(options, function(response) {
		  console.log("Telegram API response status code: ", response.statusCode);
		});
		t_api_req.on('error', function(e) {
		  console.error(e);
		});
		t_api_req.write(payload);
		t_api_req.end();
		//End Telegram API call
		res.status(200).end();
	} else {
		console.log('Token mismatch');
		res.status(400).end();
	}

});

module.exports = router;
