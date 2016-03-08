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
		//Check if any active spell for the user chat
		var user_chat_id = req_payload.source + '|' + req_payload.user_id + '|' + req_payload.chat_id;
		console.log('User chat ID: ' + user_chat_id);
		myFirebaseRef.child('user_chats/active/' + user_chat_id).once('value', function(data) {
			var active_spell = data.val();
			console.log('Active Spell: ' + JSON.stringify(data.val()));
		  	if (active_spell === undefined || active_spell === null) {
			    //create a new spell if command is valid
			    var message = req_payload.text;
			    myFirebaseRef.child('spells/' + message).once('value', function(data) {
			    	var spell_definition = data.val();
			    	if (spell_definition === undefined || spell_definition === null) {
			    		//Invalid spell, reply back as invalid
			    		console.log('Invalid Spell requested: ' + message);
			    		respond_to_bot(req_payload.source, req_payload.chat_id, 'Sorry, I could not understand this request!');
			    	} else {
			    		//Valid Spell, Start new active spell for the user chat.
			    		console.log('Valid Spell: ' + JSON.stringify(spell_definition));
			    		var active_spell = {
						  spell: message,
						  start_time: (new Date()).getTime()
						};
			    		myFirebaseRef.child('user_chats/active/' + user_chat_id).set(active_spell, function(error) {
			    			if(error){
			    				console.log('Failed while starting a new spell');
			    			} else {
			    				console.log('Started a new spell: ' + JSON.stringify(active_spell) + '. For user chat: ' + user_chat_id);
			    				//Check if spell has more requirements
								process_next_requirement(user_chat_id, active_spell, spell_definition);
			    			}
			    		});
			    	}
			    });
			} else {
				//check if valid answer (if there is an active spell we should be waiting for an answer)
				//If escape command, exit the spell 
				if(req_payload.text === 'bye') {
					end_spell(user_chat_id, active_spell, null, false);
					respond_to_bot(req_payload.source, req_payload.chat_id, "Ok! Quiting this request.");
				} 
				else if (active_spell.reconfirmed != undefined && active_spell.reconfirmed != null && active_spell.reconfirmed === false) {
					//Check if confirmed by message
					if(req_payload.text === 'ok') {
						//End Spell
						active_spell.reconfirmed = true;
						//Get spell definition
						myFirebaseRef.child('spells/' + active_spell.spell).once('value', function(data) {
				    		var spell_definition = data.val();
				    		if (spell_definition === undefined || spell_definition === null) {
				    			//Invalid spell, reply back as invalid
				    			console.log('Looks like spell definition is no longer valid: ' + active_spell.spell);
				    			end_spell(user_chat_id, active_spell, null, false);
				    		} else {
				    			console.log('The request is reconfirmed, ending spell for: ' + user_chat_id);
				    			end_spell(user_chat_id, active_spell, spell_definition, true);
				    		}	
				    	});
					} else {
						//Request not confirmed, lets cancel the Spell
						end_spell(user_chat_id, active_spell, null, false);
						respond_to_bot(req_payload.source, req_payload.chat_id, "Ok! Quiting this request.");
					}
				} else {
					//To check answer, first get spell definition
					myFirebaseRef.child('spells/' + active_spell.spell).once('value', function(data) {
			    		var spell_definition = data.val();
			    		if (spell_definition === undefined || spell_definition === null) {
			    			//Invalid spell, reply back as invalid
			    			console.log('Looks like spell definition is no longer valid: ' + active_spell.spell);
			    			end_spell(user_chat_id, active_spell, null, false);
			    		} else {
			    			//Find the requirement that's asked
			    			if(active_spell.requirements != undefined && active_spell.requirements != null) {
			    				var found_open_requirement = false;
								for(requirement_id in active_spell.requirements) {
									if(active_spell.requirements[requirement_id].status ==='asked') {
										found_open_requirement = true;
										var required_spell_definition = spell_definition.requirements[requirement_id];
										if(required_spell_definition.question_type === 'user_information') {
											//TODO Validate if response is of right format
											//Update user_information table and the active spell with the response
											var user_info_update = {};
											if(required_spell_definition.question =='email')
												user_info_update = {email: req_payload.text};
											if(required_spell_definition.question =='phone')
												user_info_update = {phone: req_payload.text};
											myFirebaseRef.child('user_information/' + req_payload.source + '|' + req_payload.user_id).update(user_info_update, function(error) {
												if(error) {
													console.log('Default user information update failed. ' + JSON.stringify(active_spell));
												} else {
													//Update active spell
													active_spell.requirements[requirement_id].answer = req_payload.text;
													active_spell.requirements[requirement_id].status = 'answered';
													//Update database and recurse
													myFirebaseRef.child('user_chats/active/' + user_chat_id).set(active_spell, function(error) {
														if(error) {
															console.log('Error while updating active spell with answer: ' + user_chat_id);
														} else {
															console.log('Updated active spell answer: ' + user_chat_id);
															//Continue and check for next requirement
															process_next_requirement(user_chat_id, active_spell, spell_definition);
														}
													});
												}
											});
										} else if(required_spell_definition.question_type === 'text') {
											//Update the active spell with the response
											active_spell.requirements[requirement_id].answer = req_payload.text;
											active_spell.requirements[requirement_id].status = 'answered';
											//Update database and recurse
											myFirebaseRef.child('user_chats/active/' + user_chat_id).set(active_spell, function(error) {
												if(error) {
													console.log('Error while updating active spell with answer: ' + user_chat_id);
												} else {
													console.log('Updated active spell answer: ' + user_chat_id);
													//Continue and check for next requirement
													process_next_requirement(user_chat_id, active_spell, spell_definition);
												}
											});
										} else if(required_spell_definition.question_type === 'options') {
											//TODO Validate if response is a valid option
											//Update the active spell with the response
											active_spell.requirements[requirement_id].answer = req_payload.text;
											active_spell.requirements[requirement_id].status = 'answered';
											//Update database and recurse
											myFirebaseRef.child('user_chats/active/' + user_chat_id).set(active_spell, function(error) {
												if(error) {
													console.log('Error while updating active spell with answer: ' + user_chat_id);
												} else {
													console.log('Updated active spell answer: ' + user_chat_id);
													//Continue and check for next requirement
													process_next_requirement(user_chat_id, active_spell, spell_definition);
												}
											});
										} else {
											//This is unlikely
											console.log('Unknown requirement question type. Check definition: ' + JSON.stringify(spell_definition) + '. User Chat ID ' + user_chat_id);
										}
										break;
									}
								}
								if(!found_open_requirement) {
									//Something wrong, there is no open requirement in the spell. Let's close it.
									console.log('There is an active spell, but no open question: ' + user_chat_id);
									end_spell(user_chat_id, active_spell, null, false);
									respond_to_bot(req_payload.source, req_payload.chat_id, "Looks like some prob! Quiting previous request.");
								}
							} else {
								//Something wrong, there is no open requirement in the spell. Let's close it.
								console.log('There is an active spell, but no open question: ' + user_chat_id);
								end_spell(user_chat_id, active_spell, null, false);
								respond_to_bot(req_payload.source, req_payload.chat_id, "Looks like some prob! Quiting previous request.");
							}
			    		}
			    	});
				}
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

function end_spell(user_chat_id, active_spell, spell_definition, call_outgoing_webhook) {
	if( (call_outgoing_webhook = true) && 
		(spell_definition.dont_reconfirm === undefined || spell_definition.dont_reconfirm === null || spell_definition.dont_reconfirm === false) &&
		(active_spell.reconfirmed === undefined || active_spell.reconfirmed === null || active_spell.reconfirmed === false) ) {
		//Mark active spell as awaiting confirmation
		active_spell.reconfirmed = false;
		myFirebaseRef.child('user_chats/active/' + user_chat_id).set(active_spell, function(error) {
			if(error) {
				console.log('Error while updating active spell user information answer: ' + user_chat_id);
			} else {
				console.log('Updated active spell user information answer: ' + user_chat_id);
				//Respond with a confirmation request
				respond_to_bot(req_payload.source, req_payload.chat_id, 'This request: ' + spell_definition.description + '. To confirm type "ok", to quit type "bye".');
			}
		});
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
		    	old_spell.user_chat_id = user_chat_id;
		    	var formattedDate = moment(new Date()).format('YYYYMMDD');
			    myFirebaseRef.child('user_chats/old/' + formattedDate).push(old_spell, function(error) {
			  		if (error) {
			    		console.log('Archive failed: ' + user_chat_id);
			  		} else {
			  			console.log('Successfully archived: ' + user_chat_id);
			  			if(call_outgoing_webhook) {
			  				//Call Outgoing Webhook
			  				console.log('Going to make request to outgoing webhook: ' + JSON.stringify(active_spell));
			  				console.log('Spell definition: ' + JSON.stringify(spell_definition));
			  				//TODO
			  			}
			  		}
				});
			}
		});
	}
};

function process_next_requirement(user_chat_id, active_spell, spell_definition){
	if(spell_definition.requirements === undefined || spell_definition.requirements === null) {
		//End Spell
		end_spell(user_chat_id, active_spell, spell_definition, true);
	} else {
		var active_spell_req_level = 0;
		var spell_definition_req_level = 0;
		var user_information_requirements = [];
		var other_requirements = [];
		var completed_requirements = [];
		//Structure Spell Definition Requirements
		for(requirement_id in spell_definition.requirements) {
			spell_definition_req_level++;
			var requirement = spell_definition.requirements[requirement_id];
			if(requirement.question_type === 'user_information'){
				user_information_requirements.push(requirement_id);
			} else {
				other_requirements.push(requirement_id);
			}
		}
		console.log('Number of user information requirements in spell definition: ' + user_information_requirements.length);	
		console.log('Total requirements in spell definition: ' + spell_definition_req_level);	
		//Check completed Requirements
		if(active_spell.requirements != undefined && active_spell.requirements != null) {
			for(requirement_id in active_spell.requirements) {
				active_spell_req_level++;
				completed_requirements.push(requirement_id);
			}
		}
		console.log('Completed requirements: ' + active_spell_req_level);
		if(spell_definition_req_level === active_spell_req_level) {
			console.log('No further requirements for: ' + user_chat_id);
			//End the active spell
			end_spell(user_chat_id, active_spell, spell_definition, true);
		} else {
			//Find next pending Requirement
			var next_requirement_id = null;
			//See if all other requirements are completed
			for(var i=0; i<other_requirements.length; i++){
				if(completed_requirements.indexOf(other_requirements[i]) < 0){
					console.log('Pending other requirement: ' + other_requirements[i] + '. For: ' + user_chat_id);
					next_requirement_id = other_requirements[i];
					break;
				}
			}
			if(next_requirement_id === null){
				//See if all user information requirements are completed
				 for(var i=0; i<user_information_requirements.length; i++){
					if(completed_requirements.indexOf(user_information_requirements[i]) < 0){
						console.log('Pending user information requirement: ' + user_information_requirements[i] + '. For: ' + user_chat_id);
						next_requirement_id = user_information_requirements[i];
						break;
					}
				}
			}
			if(next_requirement_id != null) {
				//Process the requirement
				//Get definition
				next_requirement = spell_definition.requirements[next_requirement_id];
				if(next_requirement.question_type === 'user_information') {
					//Check if user data already set.
					var user_chat_keys = user_chat_id.split('|');
					myFirebaseRef.child('user_information/' + user_chat_keys[0] + '|' + user_chat_keys[1]).once('value', function(data) {
						var user_information = data.val();
						var user_information_exists = false;
						if(user_information != undefined && user_information != null) {
							if(user_information[next_requirement.question] != undefined && user_information[next_requirement.question] != null ) {
								user_information_exists = true;
								//Set requirement in active_spell with default data
								if(active_spell.requirements === undefined || active_spell.requirements === null)
									active_spell.requirements = {};
								active_spell.requirements[next_requirement_id] = {question: next_requirement.question, answer: user_information[next_requirement.question], status: 'auto_filled'};
								//Update database and recurse
								myFirebaseRef.child('user_chats/active/' + user_chat_id).set(active_spell, function(error) {
									if(error) {
										console.log('Error while updating active spell user information answer: ' + user_chat_id);
									} else {
										console.log('Updated active spell user information answer: ' + user_chat_id);
										//Continue and check for next requirement
										process_next_requirement(user_chat_id, active_spell, spell_definition);
									}
								});
							}
						} 
						if(!user_information_exists){
							//Prompt to enter user information
							var prompt_question = '';
							if(next_requirement.question === 'email') {
								prompt_question = 'Type your email ID. This will be a one time entry, you can change it later by typing "contact".';
							} else if(next_requirement.question === 'phone') {
								prompt_question = 'Type your mobile phone number. This will be a one time entry, you can change it later by typing "contact".';
							} else {
								console.log('Unexpected user information question: ' + user_chat_id);
								prompt_question = 'Type ' + next_requirement.question;
							}
							//TODO for address, location, name etc.
							//Update active spell and prompt for answer
							if(active_spell.requirements === undefined || active_spell.requirements === null)
								active_spell.requirements = {};
							active_spell.requirements[next_requirement_id] = {question: next_requirement.question, status: 'asked'};
							myFirebaseRef.child('user_chats/active/' + user_chat_id).set(active_spell, function(error) {
								if(error) {
									console.log('Error while updating active spell user information answer: ' + user_chat_id);
								} else {
									console.log('Updated active spell user information answer: ' + user_chat_id);
									//Call respond_to_bot for getting answer
									var user_chat_keys = user_chat_id.split('|');
									respond_to_bot(user_chat_keys[0], user_chat_keys[2], prompt_question);
								}
							});
						}
					});
				} else if(next_requirement.question_type === 'text') {
					//Update active spell and prompt for answer
					if(active_spell.requirements === undefined || active_spell.requirements === null)
						active_spell.requirements = {};
					active_spell.requirements[next_requirement_id] = {question: next_requirement.question, status: 'asked'};
					myFirebaseRef.child('user_chats/active/' + user_chat_id).set(active_spell, function(error) {
						if(error) {
							console.log('Error while updating active spell user information answer: ' + user_chat_id);
						} else {
							console.log('Updated active spell user information answer: ' + user_chat_id);
							//Call respond_to_bot for getting answer
							var user_chat_keys = user_chat_id.split('|');
							respond_to_bot(user_chat_keys[0], user_chat_keys[2], next_requirement.question);
						}
					});
				} else if(next_requirement.question_type === 'options') {
					console.log('For reference, Spell Definition: ' + JSON.stringify(spell_definition));
					var answer_options = spell_definition.requirements[next_requirement_id].options;
					if(answer_options instanceof Array) {
						console.log('Answer Options is array');
						//Remove null
						answer_options = answer_options.filter(function(n){ return n != undefined }); 
					}
					console.log('For reference, Answer Options: ' + JSON.stringify(answer_options));
					var prompt_question = next_requirement.question + '. Type your option: ' + JSON.stringify(answer_options);
					//Update active spell and prompt for answer
					if(active_spell.requirements === undefined || active_spell.requirements === null)
						active_spell.requirements = {};
					active_spell.requirements[next_requirement_id] = {question: next_requirement.question, status: 'asked'};
					console.log('Updating active spell with asked requirement: ' + JSON.stringify(active_spell));
					myFirebaseRef.child('user_chats/active/' + user_chat_id).set(active_spell, function(error) {
						if(error) {
							console.log('Error while updating active spell user information answer: ' + user_chat_id);
						} else {
							console.log('Updated active spell user information answer: ' + user_chat_id);
							//Call respond_to_bot for getting answer
							var user_chat_keys = user_chat_id.split('|');
							respond_to_bot(user_chat_keys[0], user_chat_keys[2], prompt_question);
						}
					});
				} else {
					console.log('Unknown requirement question type. Check definition: ' + JSON.stringify(spell_definition) + '. User Chat ID ' + user_chat_id);
				}
			} else {
				console.log('Unable to find next requirement! Spell Definition levels: ' + spell_definition_req_level + '. Active Spell levels: ' + active_spell_req_level);
			}
		}
	}

};

module.exports = router;