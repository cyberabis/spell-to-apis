var express = require('express');
var bodyParser = require('body-parser');
var app = express();

var port = process.env.PORT || 8000;

app.use(bodyParser.json());
 
//Test Route
var test = require('./routes/test');
app.use('/api/test', test);

//TelegramBot Route
var telegram = require('./routes/telegram');
app.use('/api/telegram', telegram);

//ReqProcessor Route
var reqprocessor = require('./routes/reqprocessor');
app.use('/api/reqprocessor', reqprocessor);

app.listen(port);
console.log('SpellTo APIs is listening on port: ' + port);