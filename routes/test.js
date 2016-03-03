var express = require('express');
var router = express.Router();

router.get('/:data', function(req, res) {
	var data = req.params.data;

	console.log('Got test data: ' + data);
	var result = {test_data: data};

	res.status(200).json(result);

});

module.exports = router;