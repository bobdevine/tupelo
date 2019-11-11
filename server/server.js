//const http = require("http");
const express = require('express');
//const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
//var cors = require('cors');

const fs = require('fs');
//const path = require('path');

const peg = require("pegjs");

const tupelo = require("./tupelo");
tupelo.init();

const config = require("./config");
const { SERVER: { PORT } } = config;


const SQL_GRAMMAR = fs.readFileSync('sql.pegjs', { encoding: 'utf8' });
//console.log('grammar: ', SQL_GRAMMAR);
const SQL_PARSER = peg.generate(SQL_GRAMMAR);

const app = express()
const port = process.argv[2] || PORT;

app.use(bodyParser.urlencoded({extended: true}));


app.get('/', function (request, response) {
    console.log('GET request');
    response.send('GET /')
});


app.post('/query', function (request, response) {
    //console.log('QUERY request body=' + request.body);
    response.header("Access-Control-Allow-Origin", "*");
    response.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    var cmd = '';
    for (var item in request.body) {
	//console.log("CMD item:" + item);
	var tags = null;
	try {
	    tags = JSON.parse(item);
	} catch(e) {
	    console.log('JSON parse error for ' + item);
	    response.status(200);
	    response.send('JSON parse error: ' + item);
	    return;
	}
        for (var key in tags) {
	    var value = "" + tags[key];
	    if (key == "cmd") {
		cmd = value;
	    } else {
		console.log("unknown param " + key);
	    }
        }
    }
    //console.log('SQL cmd=' + cmd);
    response.status(200);
    var ast;
    try {
	ast = SQL_PARSER.parse(cmd);
    } catch (err) {
	console.log(err);
	response.send(err.toString());
	return;
    }

    try {
	var answer = tupelo.queryExec(ast);
	response.send(answer);
	//console.log("ANSWER=" + answer);
    } catch (err) {
	console.log(err);
	response.send("Execution: " + err.toString());
	return;
    }
});


const server = app.listen(port, function() {
    //var host = server.address().address;
    console.log("TUPELO server listening on port", port);
});
