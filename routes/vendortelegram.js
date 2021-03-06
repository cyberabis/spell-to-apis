var express = require('express');
var router = express.Router();
var https = require('https');

var vendor_bot_api_token = process.env.VENDOR_BOT_API_TOKEN;
var my_token = process.env.VENDOR_TELEGRAM_TOKEN;
var default_webhook_token = process.env.DEFAULT_WEBHOOK_TOKEN;
var default_webhook_url = process.env.DEFAULT_WEBHOOK_URL;

//RECEIVE MESSAGE METHOD - INVOKED BY VENDOR TELEGRAM API WEBHOOK
router.post('/receive/:token', function(req, res) {
	var token = req.params.token;

	var update_id = req.body.update_id;
	var message = req.body.message;
	var inline_query = req.body.inline_query;
	var chosen_inline_query = req.body.chosen_inline_query;
	
	//Authenticate token
	if(token === my_token) {
		//Start: Forward Message to Default Webhook Vendor Register
		var d = {
			source: 'telegram',
			update_id: update_id,
			user_id: message.from.id,
			user_name: message.from.first_name, 
			timestamp: message.date,
			chat_id: message.chat.id,
			text: message.text
		};
		var payload = JSON.stringify(d);
		console.log('Payload to DefaultWebhookVendorRegister: ' + payload);

		var options = {
		  hostname: default_webhook_url,
		  path: '/api/defaultwebhook/registervendor/' + default_webhook_token,
		  method: 'POST',
		  headers: {
		  	'Content-Type': 'application/json',
		  	'Content-Length': payload.length
		  }
		};

		var reqprocessor_api_req = https.request(options, function(response) {
		  console.log("DefaultWebhookRegisterVendor API response status code: ", response.statusCode);
		});
		reqprocessor_api_req.on('error', function(e) {
		  console.error(e);
		});
		reqprocessor_api_req.write(payload);
		reqprocessor_api_req.end();
		//End: Forward Message to Default Webhook Vendor Register

		res.status(200).end();
	} else {
		console.log('Token mismatch');

		res.status(400).end();
	}
});

//SEND MESSAGE METHOD - INVOKED BY Request or Response Processor
/*
Payload example:
{
    "text":"yeah, it works",
    "chat_id":81390528
}
*/
router.post('/send/:token', function(req, res) {
	var token = req.params.token;
	var chat_id = req.body.chat_id;
	var text = req.body.text;

	console.log('Sending text: ' + text + '. Chat id: ' + chat_id);
	console.log('Bot API token: ' + vendor_bot_api_token);
	if(token === my_token) {
		//Call Telegram API
		var d = {chat_id: chat_id, text: text};
		var payload = JSON.stringify(d);

		var options = {
		  hostname: 'api.telegram.org',
		  path: '/' + vendor_bot_api_token + '/sendMessage',
		  method: 'POST',
		  headers: {
		  	'Content-Type': 'application/json',
		  	'Content-Length': payload.length
		  }
		};

		var t_api_req = https.request(options, function(response) {
		  console.log('Vendor Telegram API response status code: ', response.statusCode);
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
