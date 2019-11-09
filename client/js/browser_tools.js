function ajaxRequest() {
    if (window.XMLHttpRequest) // Mozilla, Chrome, Safari, etc
	return new XMLHttpRequest();
    else if (window.ActiveXObject) { // older IE
	var activexmodes = ["Msxml2.XMLHTTP", "Microsoft.XMLHTTP"];
	for (var i=0; i<activexmodes.length; i++) {
	    try {
		var activex = new ActiveXObject(activexmodes[i]);
		return activex;
	    }
	    catch(e){ }
	}
    }
    
    return null;
}

function readCookie(name) {
    var nameEQ = name + "=";
    var ca = document.cookie.split(';');
    for (var i=0; i < ca.length; i++) {
	var c = ca[i];
	while (c.charAt(0)==' ') c = c.substring(1,c.length);
	if (c.indexOf(nameEQ) == 0)
	    return c.substring(nameEQ.length,c.length);
    }
    return null;
}

function createCookie(name, value, days) {
    var expires = "";
    if (days) {
	var date = new Date();
	date.setTime(date.getTime() + (days*24*60*60*1000));
	expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + value + ";" + expires + "; path=/";
}
