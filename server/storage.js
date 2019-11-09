const fs = require('fs');

const config = require("./config");
const { TUPELO: { TUPELO_DIR, TUPELO_VERSION, TUPELO_PREFIX, TUPELO_MAGIC } } = config;
const SYSTEM_FILE = TUPELO_PREFIX + "_SYSTEM";


exports.init = function() {
    try {
	if (!fs.existsSync(TUPELO_DIR)) {
	    fs.mkdirSync(TUPELO_DIR);
	}
	//var stats = fs.statSync(TUPELO_NAME);
	//if (stats && stats.isFile()) {
	if (fs.existsSync(TUPELO_DIR + '/' + SYSTEM_FILE)) {
	    if ( !verifySystemFile()) {
		console.log("Invalid system file");
	    } else {
		console.log("TUPELO system file verified");
	    }
	} else {
	    createSystemFile();
	    console.log("TUPELO system file created");
	}
    } catch(err) {
	console.log(err);
    }
}

const default_header = {
    "tupelo_magic" : TUPELO_MAGIC,
    "version" : TUPELO_VERSION,
    "language" : "en-US"
};

function verifySystemFile() {
    var rawdata = fs.readFileSync(TUPELO_DIR + '/' + SYSTEM_FILE);
    //, 'utf-8');
    var header = JSON.parse(rawdata);
    //console.log("HEADER MAGIC = " + header.tupelo_magic);
    if (parseInt(header.tupelo_magic) != TUPELO_MAGIC) {
	return false;
    }
    return true;
}

function createSystemFile() {
    var data = JSON.stringify(default_header, null, 2);
    fs.writeFileSync(TUPELO_DIR + '/' + SYSTEM_FILE, data);
}

//------------------------
exports.tableExists = function(tablename) {
    const SystemTablesFile = TUPELO_DIR + '/' + TUPELO_PREFIX + '_TABLES';
    if (!fs.existsSync(SystemTablesFile)) {
	// create initial file
	const tables = {
	    "tupelo_magic" : TUPELO_MAGIC,
	    "version" : TUPELO_VERSION,
	    "tables" : []
	};
	var data = JSON.stringify(tables, null, 2);
        fs.writeFileSync(SystemTablesFile, data);
    }
    
    var rawdata = fs.readFileSync(SystemTablesFile);
    var jsondata = JSON.parse(rawdata);

    for (var i = 0; i<jsondata.tables.length; i++) {
	if (tablename == jsondata.tables[i].tablename) {
	    //console.log("duplicate table: " + tablename);
	    return true;
	}
    }

    return false;
}

exports.tableCreate = function(tablename, tableMetadata) {
    // step 1 -- update the TABLES file
    const SystemTablesFile = TUPELO_DIR + '/' + TUPELO_PREFIX + '_TABLES';

    var rawdata = fs.readFileSync(SystemTablesFile);
    var jsondata = JSON.parse(rawdata);

    jsondata.tables.push(tableMetadata);

    var data = JSON.stringify(jsondata, null, 2);
    fs.writeFileSync(SystemTablesFile, data);

    
    // step 2 -- create empty table file
    const tableFile = TUPELO_DIR + '/' + tablename;
    if (fs.existsSync(tableFile)) {
	console.log("table file exists: " + tablename);
    }
    const table = {
	"tupelo_magic" : TUPELO_MAGIC,
	"version" : TUPELO_VERSION,
	"tablename" : tablename,
	"rows" : []
    };
    var data = JSON.stringify(table, null, 2);
    fs.writeFileSync(tableFile, data);
}

exports.AddRow = function(tablename, values) {
    // need to handle consistency with sync/locking/etc
    const tableFile = TUPELO_DIR + '/' + tablename;
    var indata = fs.readFileSync(tableFile);
    var jsondata = JSON.parse(indata);
    var row = [];
    for (var i=0; i<values.length; i++) {
	var val = values[i];
	row.push(val);
    }
    jsondata.rows.push(row);
    var outdata = JSON.stringify(jsondata, null, 2);
    fs.writeFileSync(tableFile, outdata);
    return true;
}

exports.listAllTables = function() {
    const SystemTablesFile = TUPELO_DIR + '/' + TUPELO_PREFIX + '_TABLES';
    var allTables = [];
    var rawdata = fs.readFileSync(SystemTablesFile);
    var jsondata = JSON.parse(rawdata);

    for (var i = 0; i<jsondata.tables.length; i++) {
	allTables.push(jsondata.tables[i].tablename);
    }

    return allTables;
}

exports.getTableMetadata = function(tablename) {
    //console.log("getTableMetadata tablename= " + tablename);
    const SystemTablesFile = TUPELO_DIR + '/' + TUPELO_PREFIX + '_TABLES';
    var rawdata = fs.readFileSync(SystemTablesFile);
    var jsondata = JSON.parse(rawdata);

    var idx = -1;
    for (var i = 0; i<jsondata.tables.length; i++) {
	if (tablename == jsondata.tables[i].tablename) {
	    //console.log("found table: " + tablename);
	    idx = i;
	    break;
	}
    }

    if (idx == -1) {
	return null;
    }
    //console.log("TABLE METADATA: " + JSON.stringify(jsondata.tables[idx]));
    return jsondata.tables[idx];
}

exports.getAllRows = function(tablename) {
    // need to handle consistency with sync/locking/etc
    const tableFile = TUPELO_DIR + '/' + tablename;
    try {
	var indata = fs.readFileSync(tableFile);
	var jsondata = JSON.parse(indata);
    } catch(err) {
	console.log(err);
	throw "Unable to read rows for table " + tablename;
    }
    return jsondata.rows;
}

exports.deleteTable = function(tablename) {
    const tableFile = TUPELO_DIR + '/' + tablename;
    if (fs.existsSync(tableFile)) {
	fs.unlinkSync(tableFile);
    }

    const SystemTablesFile = TUPELO_DIR + '/' + TUPELO_PREFIX + '_TABLES';

    var rawdata = fs.readFileSync(SystemTablesFile);
    var jsondata = JSON.parse(rawdata);

    var idx = -1;
    for (var i = 0; i<jsondata.tables.length; i++) {
	if (tablename == jsondata.tables[i].tablename) {
	    console.log("found table: " + tablename);
	    idx = i;
	    break;
	}
    }

    // update the TABLES file
    if (idx == -1) {
	return false;
    }
    
    jsondata.tables.splice(idx, 1);
    var data = JSON.stringify(jsondata, null, 2);
    fs.writeFileSync(SystemTablesFile, data);
    return true;
}
    
