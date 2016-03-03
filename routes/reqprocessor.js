var express = require('express');
var router = express.Router();
var https = require('https');

var bot_api_token = process.env.BOT_API_TOKEN;
var my_token = process.env.MY_TOKEN;

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

		res.status(200).end();
	} else {
		console.log('Token mismatch');

		res.status(400).end();
	}

});

module.exports = router;