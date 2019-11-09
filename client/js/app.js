function sendToTupelo() {
    //window.alert("sendToTupelo");
    var queryText = document.getElementById('commandTextarea');
    //window.alert("queryText=" + queryText.value);

    if (queryText.value == "")
    { 
	var queryResult = document.getElementById('resultTextarea');
	queryResult.innerHTML = "Enter a SQL command";
	return false;
    }
    var xmlhttp = new ajaxRequest();
    xmlhttp.onreadystatechange = QueryCallback;
    xmlhttp.open("POST", "http://localhost:8080/query", true);
    xmlhttp.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    //xmlhttp.setRequestHeader("Content-type", "application/json;charset=UTF-8");
    var str = queryText.value;
    str = str.replace(/(\r\n|\n|\r)/gm, " ");
    str = str.replace(/\"/gm, "'");
    var body = JSON.stringify({ "cmd" : encodeURIComponent(str) } );
    xmlhttp.send(body);
    
    return false;
}

function QueryCallback (data) {
    //window.alert("OnReadyState state=" + this.readyState + " status=" + this.status + " text=" + this.responseText);
    if (this.readyState == 4) {
	var queryResult = document.getElementById('QueryResult');
        if (this.status == 200) {
	    if (this.responseText.charAt(0) != "{") {
		queryResult.innerHTML = this.responseText;
		return;
	    }
	    //alert(this.responseText);
	    var answer = {};
	    try {
		answer = JSON.parse(this.responseText);
	    } catch(err) {
		alert(this.responseText);
		queryResult.innerHTML = err;
	    }
	    var formattedTable = '<table border="1" style="border-collapse:collapse;">';
	    formattedTable += "<thead>";
	    formattedTable += "<tr>";
	    for (var i=0; i<answer.headers.length; i++) {
		var colname = answer.headers[i];
		formattedTable += '<th>' + colname + '</th>';
	    }
	    formattedTable += "</tr>";
	    formattedTable += "</thead>";

	    for (var i=0; i<answer.rows.length; i++) {
		formattedTable += "<tr>";
		for (var j=0; j<answer.headers.length; j++) {
		    formattedTable += '<td>' + answer.rows[i][j] + '</td>';
		}
		formattedTable += "</tr>";
	    }
	    formattedTable += "</table>";
	    
	    if (answer.rows.length == 0) {
		formattedTable += "<br>(0 rows)";
	    } else if (answer.rows.length == 1) {
		formattedTable += "<br>(1 row)";
	    } else {
		formattedTable += "<br>(" +  answer.rows.length + " rows)";
	    }
	    //alert(formattedTable);
	    queryResult.innerHTML = formattedTable;
	} else if (this.status == 0) {
	    queryResult.innerHTML = "Server is not reachable."
	} else {
	    queryResult.innerHTML = "Command failed, server status code: " + this.status;
	}
    }
}

