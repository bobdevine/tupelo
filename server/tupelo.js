"use strict";

const fs = require("fs");

const Optimizer = require("./optimizer");
const Storage = require("./storage");
const Operators = require("./operators");


exports.init = function(fs) {
    //console.log("TUPELO init");
    Storage.init();
};


function TableInfo(name, alias) {
    this.name = name;
    this.alias = alias;
    this.columns = [];
    this.lang = null;
}

function ColumnInfo(name) {
    this.name = name;
    this.scope = null;
    this.typename = null;
    this.typesize = 0;
    this.iskey = false;
    this.nullable = false;
    this.defaultvalue = 0;
}


//-----------------------------------------------------------
exports.queryExec = function(ast) {
    //console.log("queryExec");
    //console.log("AST=" + JSON.toString(ast));
    console.log("AST mydump " + mydump(ast));
    console.log("AST dumpObj " + dumpObj(ast));
    var answer = "";
    for (var s=0; s<ast.length; s++) {
	//console.log("STMT= " + ast[s].stmt);
	switch (ast[s].stmt) {
	case "CREATE_TABLE":
	    answer += stmtCreateTable(ast[s]);
	    break;
	case "SHOW_TABLE":
	    answer += stmtShowTable(ast[s]);
	    break;
	case "SHOW_TABLES":
	    answer += stmtShowTables();
	    break;
	case "DROP_TABLE":
	    answer += stmtDropTable(ast[s]);
	    break;
	case "INSERT":
	    answer += stmtInsert(ast[s]);
	    break;
	case "SELECT":
	    answer += stmtSelect(ast[s]);
	    break;
	case "BLANK":
	    // pseudo-statement to simplify grammar for final ';'
	    break;
	default:
	    return "Unknown stmt: " + ast[s].stmt;
	}
	//answer += "<br>";
    }
    return answer;
};


function stmtCreateTable(ast) {
    //console.log("CREATE TABLE " + ast.tablename);
    if (Storage.tableExists(ast.tablename)) {
	console.log("duplicate table: " + ast.tablename);
	return "Table: '" + ast.tablename + "' already exists";
    }

    var tableMetadata = {
	"tablename" : ast.tablename,
	"columns" : []
    };
    //console.log("  table=" + ast.tablename);
    //console.log("  cols=");
    for (var i=0; i<ast.tcols.length; i++) {
	//console.log("    colname=" + ast.tcols[i].colname);
	//console.log("    coltype=" + ast.tcols[i].coltype.typename);
	//console.log("    colsize=" + ast.tcols[i].coltype.typesize);
	var isnullable = true;
	if (ast.tcols[i].constraint == "NOTNULL") {
	    isnullable = false;
	}
	var ci = new ColumnInfo(ast.tcols[i].colname);
	ci.typename = ast.tcols[i].coltype.typename,
	ci.typesize = ast.tcols[i].coltype.typesize,
	ci.isnullable = isnullable,
	ci.iskey = false,
	ci.defaultvalue = 0,
	tableMetadata.columns.push(ci);
    }
    Storage.tableCreate(ast.tablename, tableMetadata);

    return "Table " + ast.tablename + " created";
}


function stmtShowTables() {
    //console.log("SHOW TABLES");
    var allTables = Storage.listAllTables();
    var table_list = "ALL TABLES: ";

    for (var i = 0; i<allTables.length; i++) {
	if (i>0) {table_list += ", ";}
	table_list += allTables[i];
    }
    
    return table_list;
}

function stmtShowTable(ast) {
    //console.log("SHOW TABLE");
    var tableMetadata = Storage.getTableMetadata(ast.tablename);

    if (tableMetadata == null) {
	return "Table '" + ast.tablename + "' not found";
    }

    var table_info = ast.tablename + "(";
    for (var i=0; i<tableMetadata.columns.length; i++) {
	if (i>0) {table_info += ", ";}
	table_info += tableMetadata.columns[i].name;
    }
    table_info += ")";

    return table_info;
}


function stmtDropTable(ast) {
    //console.log("DROP TABLE");
    // delete the specific file
    if (Storage.deleteTable(ast.tablename)) {
	return "Table " + ast.tablename + " dropped";
    } else {
	return "Table " + ast.tablename + " not found, not dropped";
    }
}

function stmtInsert(ast) {
    //console.log("INSERT");
    var md = Storage.getTableMetadata(ast.tablename);
    if (md == null) {
	return "Unknown table: " + ast.tablename;
    }
    // check for correct columns
    for (var i=0; i<ast.columns.length; i++) {
	var colname = ast.columns[i];
	var nameFound = false;
	for (var c=0; c<md.columns.length; c++) {
	    //console.log("INSERT col: " + colname + " MD col: " + md.columns[c].name);
	    // not safe to use case-independent comparison
	    if (colname == md.columns[c].name) {
		nameFound = true;
		break;
	    }
	}
	if (nameFound == false) {
	    return "Insert column '" + colname + "' not in table " + ast.tablename;
	}
    }

    // ensure each row is complete and values pass constraint checks
    var successfulInserts = 0;
    for (var g=0; g<ast.values.length; g++) {
	if (ast.columns.length != ast.values[g].length) {
	    return "Mismatched number of columns and values";
	}
	// 1) start with a row of nulls
	var values = [];
	for (var c=0; c<md.columns.length; c++) {
	    var colValue = {
		colname: md.columns[c].name,
		value: null,
		isFinal: false
	    };
	    values.push(colValue);
	}
	// 2) fill in the row with supplied values
	for (var i=0; i<ast.columns.length; i++) {
	    for (var v=0; v<values.length; v++) {
		if (ast.columns[i] == values[v].colname) {
		    var val = ast.values[g][i];
		    if (typeof val === "string") {
			if (val.toUpperCase() == "NULL") {
			    values[v].value = null;
			} else if (val.charAt(0) == "'") {
			    // trim quoted string
			    var last = val.length - 1;
			    values[v].value = val.slice(1, last);
			} else {
			    // general string
			    values[v].value = val;
			}
		    } else {
			// all other typed values
			values[v].value = val;
		    }
		    values[v].isFinal = true;
		}
	    }
	}
	// 3) verify the row is valid
	var row = [];
	for (var v=0; v<values.length; v++) {
	    for (var c=0; c<md.columns.length; c++) {
		if (md.columns[c].name == values[v].colname) {
		    if (values[v].value == null) {
			// SQL sucks, part 87 -- NULL has universal type
			if (!md.columns[c].isnullable ) {
			    return "Error, cannot insert a NULL into the non-nullable column " + values[v].colname;
			}
		    } else if (!typeMatch(values[v].value, md.columns[c].typename)) {
			return "Type mismatch for insert into column '" + values[v].colname + "', defined type is " + md.columns[c].typename;
		    }
		}
	    }
	    row.push(values[v].value);
	}
	
	if (!Storage.AddRow(ast.tablename, row)) {
	    return "INSERT failed for table " + ast.tablename;
	}
	successfulInserts += 1;
    }
	
    if (successfulInserts == 1) {
	return "Row inserted into table " + ast.tablename;
    } else {
	return "" + successfulInserts + " rows inserted into table " + ast.tablename;
    }
}

function typeMatch(value, typename) {
    //console.log("typeMatch: value=" + value + " type=" + typename);
    switch (typename) {
    case "INTEGER":
	// better than using typeof or regex or parseInt or ...
	// return Math.ceil(parseFloat(value)) === value;
	// hack: check for numeric that has no fractional part
	//return (Number(value) === value && value % 1 === 0);
	// this faster but bitwise OR is only supports signed 32-bit integers
	return value === +value && value === (value|0);
    case "DOUBLE":
    case "FLOAT":
	// accept any numeric value
	//var pattern = /^[-+]?[0-9]+\.[0-9]+$/;
	//return (Number(value) === value && value % 1 !== 0);
	return (Number(value) == value);
    case "VARCHAR":
	return (typeof value === "string");
    default:
	console.log("typeMatch: unknown type=" + typename);
	return false;
    }
    return true;
}

//------------------------------------------------------------------------

function stmtSelect(ast) {
    try {
	const treeLogical = LogicalSelectPlanner(ast);
	console.log("-----LOGICAL TREE >>>>");
	treeLogical.printTree();
	console.log("-----LOGICAL TREE <<<<");
	const treePhysical = Optimizer.optimize(treeLogical);
	console.log("-----PHYSICAL TREE >>>>");
	treePhysical.printTree();
	console.log("-----PHYSICAL TREE <<<<");
	return treePhysical.exec();
    } catch(err) {
        console.log(err);
	return "ERROR: " + err;
    }
}
// convert AST to a logical tree using Semantic Analysis
function LogicalSelectPlanner(ast)
{
    //console.log("Building planner");
    var tableMetadata = []; // array of TableInfo

    // step 0: check SQL query for validity
    // - if a HAVING clause is present, then there must be a GROUP BY clause
    // - ORDER BY and GROUP BY clauses may not refer to terms in outer queries
    // - a GROUP BY clause can not have appregate functions

    // Step 1: Handle list of tables
    var opCP = new Operators.CartesianProduct();
    for (var i=0; i<ast.from.length; i++) {
	// note -- same table might be listed multiple times (self-joins)
	//console.log("LogicalPlanner: table=" + ast.from[i].table);
	if (! ast.from[i].hasOwnProperty("table")) {
	    throw "internal error - missing 'table' property"
	}
	
	var op = buildDataSource(tableMetadata, ast.from[i]);
	opCP.addChild(op);
		
	var props = new Operators.Properties();
	for (var c=0; c<op.colsOutput.length; c++) {
	    //console.log("LogicalPlanner: col=" + op.colsOutput[c]);
	    opCP.colsOutput.push(op.colsOutput[c]);
	    props.columns.push(op.colsOutput[c]);
	}
	opCP.requiredChildProperties.push(props);
    }
    
    var opTOP = opCP;

    if (tableMetadata.length == 0) {
	console.log("no tables in symbol table");
	throw "Internal error: no tables found for query";
    }

    for (var i=0; i<tableMetadata.length; i++) {
	if (tableMetadata[i].columns.length == 0) {
	    console.log("no columns in table " + tableMetadata[i].name);
	    throw "Internal error: no columns in table";
	}
    }

    // if not an EXPLAIN, add a DISPLAY op to tree top
    //console.log("build tree from the collected query and schema");
    var opDisplay = new Operators.Display();
    opDisplay.addChild(opTOP);
    var propsDisplay = new Operators.Properties();

    //console.log("STEP 1 : check fields from WHERE");
    // (here, the SELECT op is a relational operator, not the SQL verb)
    if (ast.where != null) {
	//console.log("WHERE CLAUSE");
	var opSelect = new Operators.Select();
	//console.log("opTOP.colsOutput=" + opTOP.colsOutput);
	opSelect.evalTree = buildWhereTree(tableMetadata, ast.where);
	var props = new Operators.Properties();
	// for SELECT op, columns in == columns out
	for (var i=0; i<opTOP.colsOutput.length; i++) {
	    opSelect.colsOutput.push(opTOP.colsOutput[i]);
	    props.columns.push(opTOP.colsOutput[i]);
	}
	opSelect.requiredChildProperties.push(props);
	
	opSelect.children.push(opDisplay.children[0]);
	opDisplay.children[0] = opSelect;
    }

    //console.log("STEP 2: add GROUP BY");
    if (ast.groupby != null) {
	// var opGroup = new Operators.Group();
	parseGroupByClause(opSelect, tableMetadata, ast.groupby);
    }

    //console.log("step 3 validate/resolve all fields/columns");
    // SELECT a = OK
    // SELECT * = OK
    // SELECT a,* = error
    // SELECT *,a = error
    // SELECT *,* = error
    // SELECT f(a) = OK
    // SELECT f(a),b = OK with a "GROUP BY"
    // SELECT f(a),f(b) = error (but a weird class is okay)
    var countAggFunc = 0;
    var countStar = 0;
    var countTerm = 0;
    for (var f=0; f<ast.fields.length; f++) {
	if (ast.fields[f].hasOwnProperty("field")) {
	    var token = extractField(ast.fields[f].field, tableMetadata, opDisplay, propsDisplay);
	    if (token == '*') {	countStar += 1; }
	    if (token == 't') {	countTerm += 1; }
	    //if ((countStar + countTerm) >= 2) {
	    if (countStar > 1) {
		throw "SQL error: multiple *s";
	    }
	    if (countTerm > 0 && countAggFunc > 0) {
		// TODO grouping
		throw "SQL error: regular term mixed with aggregate function";
	    }
	    if (countStar > 0 && countAggFunc > 0) {
		throw "SQL error: * mixed with aggregate function";
	    }
	    if (countStar > 0 && countTerm > 0) {
		throw "SQL error: * mixed with column names";
	    }
	} else if (ast.fields[f].hasOwnProperty("func")) {
	    if (countAggFunc > 0) {
		throw "SQL error: Multiple aggregate functions";
	    }
	    if (countStar > 0) {
		throw "SQL error: aggregate function mixed with *";
	    }
	    extractFunction(ast.fields[f], opDisplay, propsDisplay);
	    countAggFunc += 1;
	} else {
	    throw "unknown type of query field " + ast.field[f];
	}
    }
    opDisplay.requiredChildProperties.push(propsDisplay);

    if (ast.duplicates != null && ast.duplicates == "DISTINCT") {
	//console.log("DISTINCT");
	var opDistinct = new Operators.Distinct();
	var propsDistinct = new Operators.Properties();
        for (var i=0; i<opDisplay.requiredChildProperties.length; i++) {
            for (var j=0; j<opDisplay.requiredChildProperties[i].columns.length; j++) {
		var colname = opDisplay.requiredChildProperties[i].columns[j];
		propsDistinct.columns.push(colname);
		opDistinct.colsOutput.push(colname);
            }
        }
	opDistinct.requiredChildProperties.push(propsDistinct);
	
	opDistinct.children.push(opDisplay.children[0]);
	opDisplay.children[0] = opDistinct;
    }
    
    if (ast.orderby != null) {
	buildOrderBy(opDisplay, ast.orderby);
    }
    
    return opDisplay;
}


function buildDataSource(tableMetadata, source) {
    //console.log("buildDataSource: source table=" + source.table);
    var op;
    if (source.hasOwnProperty("innerjointable")) {
	op = buildDataSource_INNERJOIN(tableMetadata, source);
    } else if (source.hasOwnProperty("naturaljointable")) {
	op = buildDataSource_NATURALJOIN(tableMetadata, source);
    } else if (source.hasOwnProperty("crossjointable")) {
	op = buildDataSource_CROSSJOIN(tableMetadata, source);
    } else if (source.hasOwnProperty("outerjointable")) {
	if (source.outerjointype == "FULL") {
	    op = buildDataSource_FULLOUTERJOIN(tableMetadata, source);
	} else if (source.outerjointype == "LEFT") {
	    op = buildDataSource_LEFTOUTERJOIN(tableMetadata, source);
	} else if (source.outerjointype == "RIGHT") {
	    op = buildDataSource_RIGHTOUTERJOIN(tableMetadata, source);
	} else {
	    throw "Unknown outer join type " + source.outerjointype;
	}
    } else if (source.hasOwnProperty("uniontable")) {
	var opUnion;
	if (source.all && source.all == "ALL") {
	    op = buildDataSource_UNIONALL(tableMetadata, source);
	} else {
	    op = buildDataSource_UNION(tableMetadata, source);
	}
    } else {
	op = buildDataSource_TABLE(tableMetadata, source);
    }
    //console.log("buildDataSource: DONE");
    return op;
}

function buildDataSource_INNERJOIN(tableMetadata, source) {
    //console.log("INNER JOIN");
    var opTableLeft = buildTableOperator(tableMetadata, source.table, source.alias);
    var opTableRight = buildTableOperator(tableMetadata, source.innerjointable, source.alias2);

    // double-checking; grammar should already require a join condition
    if (!source.hasOwnProperty("cond")) {
	throw "Missing condition for inner join";
    }

    var opJoin = new Operators.Join();
    buildJoinCondition(opJoin, opTableLeft, opTableRight, source.cond);
    opJoin.addChild(opTableLeft);
    opJoin.addChild(opTableRight);
    
    var propsLeft = new Operators.Properties();
    var propsRight = new Operators.Properties();

    //console.log("INNER JOIN -- set columns left");
    for (var i=0; i<opTableLeft.colsOutput.length; i++) {
	opJoin.colsOutput.push(opTableLeft.colsOutput[i]);
	propsLeft.columns.push(opTableLeft.colsOutput[i]);
    }
    //console.log("INNER JOIN -- set columns right");
    for (var i=0; i<opTableRight.colsOutput.length; i++) {
	opJoin.colsOutput.push(opTableRight.colsOutput[i]);
	propsRight.columns.push(opTableRight.colsOutput[i]);
    }
    //console.log("INNER JOIN -- done");
    opJoin.requiredChildProperties.push(propsLeft);
    opJoin.requiredChildProperties.push(propsRight);
    return opJoin;
}

function buildDataSource_NATURALJOIN(tableMetadata, source) {
    var opTableLeft = buildTableOperator(tableMetadata, source.table, source.alias);
    var opTableRight = buildTableOperator(tableMetadata, source.naturaljointable, source.alias2);    

    // NATURAL JOIN is a type of EQUI JOIN
    // columns with the same names will appear only once
    var opJoin = new Operators.Join();
    opJoin.addChild(opTableLeft);
    opJoin.addChild(opTableRight);
    opJoin.condition = '=';

    var propsLeft = new Operators.Properties();
    var propsRight = new Operators.Properties();

    // must keep all colums to execute the join
    // add a PROJECT to eliminate the common column(s)
    
    var opProject = new Operators.Project();
    opProject.children.push(opJoin);
    opProject.filter = [];
    var propsProject = new Operators.Properties();
    opProject.requiredChildProperties.push(propsProject);
    
    var columnsMatched = 0;

    for (var i=0; i<opTableLeft.colsOutput.length; i++) {
	opJoin.colsOutput.push(opTableLeft.colsOutput[i]);
	opProject.colsOutput.push(opTableLeft.colsOutput[i]);
	propsLeft.columns.push(opTableLeft.colsOutput[i]);
	propsProject.columns.push(opTableLeft.colsOutput[i]);
        opProject.filter.push(i);
    }
    for (var i=0; i<opTableRight.colsOutput.length; i++) {
	var found = false;
	for (var j=0; j<opTableLeft.colsOutput.length; j++) {
	    if (opTableLeft.colsOutput[j] == opTableRight.colsOutput[i]) {
		// TODO: check types
		found = true;
		opJoin.predicateLeftIndex = j;
		break;
	    }
	}
	if (found) {
	    columnsMatched += 1;
	    opJoin.predicateRightIndex = i;
	} else {
	    opJoin.colsOutput.push(opTableRight.colsOutput[i]);
	    opProject.colsOutput.push(opTableRight.colsOutput[i]);
            opProject.filter.push(opTableLeft.colsOutput.length + i);
	    propsProject.columns.push(opTableRight.colsOutput[i]);
	}
	propsRight.columns.push(opTableRight.colsOutput[i]);
    }

    if (columnsMatched == 0) {
	throw "tables are not compatible for a natural join";
    } else if (columnsMatched > 1) {
	throw "natural join not supported for multiple columns";
    }
    opJoin.requiredChildProperties.push(propsLeft);
    opJoin.requiredChildProperties.push(propsRight);

    return opProject;
}

function buildDataSource_CROSSJOIN(tableMetadata, source) {
    var opTableLeft = buildTableOperator(tableMetadata, source.table, source.alias);
    var opTableRight = buildTableOperator(tableMetadata, source.crossjointable, source.alias2);

    var opJoin = new Operators.Join();
    buildCrossJoinCondition(opJoin, opTableLeft, opTableRight);
    opJoin.addChild(opTableLeft);
    opJoin.addChild(opTableRight);
    
    var propsLeft = new Operators.Properties();
    var propsRight = new Operators.Properties();

    for (var i=0; i<opTableLeft.colsOutput.length; i++) {
	opJoin.colsOutput.push(opTableLeft.colsOutput[i]);
	propsLeft.columns.push(opTableLeft.colsOutput[i]);
    }
    for (var i=0; i<opTableRight.colsOutput.length; i++) {
	opJoin.colsOutput.push(opTableRight.colsOutput[i]);
	propsRight.columns.push(opTableRight.colsOutput[i]);
    }
    opJoin.requiredChildProperties.push(propsLeft);
    opJoin.requiredChildProperties.push(propsRight);
    return opJoin;
}

function buildDataSource_FULLOUTERJOIN(tableMetadata, source) {
    console.log("FULL OUTER JOIN");
    var opTableLeft = buildTableOperator(tableMetadata, source.table, source.alias);
    var opTableRight = buildTableOperator(tableMetadata, source.outerjointable, source.alias2);

    var opJoin = new Operators.OuterJoin("FULL");
    buildJoinCondition(opJoin, opTableLeft, opTableRight, source.cond);
    opJoin.addChild(opTableLeft);
    opJoin.addChild(opTableRight);

    var props = new Operators.Properties();

    var propsLeft = new Operators.Properties();
    var propsRight = new Operators.Properties();

    for (var i=0; i<opTableLeft.colsOutput.length; i++) {
	opJoin.colsOutput.push(opTableLeft.colsOutput[i]);
	propsLeft.columns.push(opTableLeft.colsOutput[i]);
    }
    for (var i=0; i<opTableRight.colsOutput.length; i++) {
	opJoin.colsOutput.push(opTableRight.colsOutput[i]);
	propsRight.columns.push(opTableRight.colsOutput[i]);
    }
    opJoin.requiredChildProperties.push(propsLeft);
    opJoin.requiredChildProperties.push(propsRight);
    return opJoin;
}

function buildDataSource_LEFTOUTERJOIN(tableMetadata, source) {
    console.log("LEFT OUTER JOIN");
    var opTableLeft = buildTableOperator(tableMetadata, source.table, source.alias);
    var opTableRight = buildTableOperator(tableMetadata, source.outerjointable, source.alias2);

    var opJoin = new Operators.OuterJoin("LEFT");
    buildJoinCondition(opJoin, opTableLeft, opTableRight, source.cond);
    opJoin.addChild(opTableLeft);
    opJoin.addChild(opTableRight);
    
    var propsLeft = new Operators.Properties();
    var propsRight = new Operators.Properties();

    for (var i=0; i<opTableLeft.colsOutput.length; i++) {
	opJoin.colsOutput.push(opTableLeft.colsOutput[i]);
	propsLeft.columns.push(opTableLeft.colsOutput[i]);
    }
    for (var i=0; i<opTableRight.colsOutput.length; i++) {
	opJoin.colsOutput.push(opTableRight.colsOutput[i]);
	propsRight.columns.push(opTableRight.colsOutput[i]);
    }
    opJoin.requiredChildProperties.push(propsLeft);
    opJoin.requiredChildProperties.push(propsRight);
    return opJoin;
}

function buildDataSource_RIGHTOUTERJOIN(tableMetadata, source) {
    console.log("RIGHT OUTER JOIN");
    var opTableLeft = buildTableOperator(tableMetadata, source.table, source.alias);
    var opTableRight = buildTableOperator(tableMetadata, source.outerjointable, source.alias2);

    var opJoin = new Operators.OuterJoin("RIGHT");
    buildJoinCondition(opJoin, opTableLeft, opTableRight, source.cond);
    opJoin.addChild(opTableLeft);
    opJoin.addChild(opTableRight);
    
    var propsLeft = new Operators.Properties();
    var propsRight = new Operators.Properties();

    for (var i=0; i<opTableLeft.colsOutput.length; i++) {
	opJoin.colsOutput.push(opTableLeft.colsOutput[i]);
	propsLeft.columns.push(opTableLeft.colsOutput[i]);
    }
    for (var i=0; i<opTableRight.colsOutput.length; i++) {
	opJoin.colsOutput.push(opTableRight.colsOutput[i]);
	propsRight.columns.push(opTableRight.colsOutput[i]);
    }
    opJoin.requiredChildProperties.push(propsLeft);
    opJoin.requiredChildProperties.push(propsRight);
    return opJoin;
}

function buildDataSource_UNIONALL(tableMetadata, source) {
    var opTableLeft = buildTableOperator(tableMetadata, source.table, source.alias);
    var opTableRight = buildTableOperator(tableMetadata, source.uniontable, source.alias2);

    if (opTableLeft.colsOutput.length != opTableRight.colsOutput.length) {
	throw "tables are not union compatible";
    }

    var opUnion = new Operators.Union();
    opUnion.addChild(opTableLeft);
    opUnion.addChild(opTableRight);
    
    var propsLeft = new Operators.Properties();
    var propsRight = new Operators.Properties();

    for (var i=0; i<opTableLeft.colsOutput.length; i++) {
	opUnion.colsOutput.push(opTableLeft.colsOutput[i]);
	propsLeft.columns.push(opTableLeft.colsOutput[i]);
    }
    for (var i=0; i<opTableRight.colsOutput.length; i++) {
	propsRight.columns.push(opTableRight.colsOutput[i]);
    }
    opUnion.requiredChildProperties.push(propsLeft);
    opUnion.requiredChildProperties.push(propsRight);
    return opUnion;
}

function buildDataSource_UNION(tableMetadata, source) {
    var opTableLeft = buildTableOperator(tableMetadata, source.table, source.alias);
    var opTableRight = buildTableOperator(tableMetadata, source.uniontable, source.alias2);

    if (opTableLeft.colsOutput.length != opTableRight.colsOutput.length) {
	throw "tables are not union compatible";
    }

    var opUnion = new Operators.Union();
    opUnion.addChild(opTableLeft);
    opUnion.addChild(opTableRight);
    
    var propsLeft = new Operators.Properties();
    var propsRight = new Operators.Properties();

    for (var i=0; i<opTableLeft.colsOutput.length; i++) {
	opUnion.colsOutput.push(opTableLeft.colsOutput[i]);
	propsLeft.columns.push(opTableLeft.colsOutput[i]);
    }
    for (var i=0; i<opTableRight.colsOutput.length; i++) {
	propsRight.columns.push(opTableRight.colsOutput[i]);
    }
    opUnion.requiredChildProperties.push(propsLeft);
    opUnion.requiredChildProperties.push(propsRight);

    var opDistinct = new Operators.Distinct();
    var propsDistinct = new Operators.Properties();
    for (var i=0; i<opUnion.colsOutput.length; i++) {
	    var colname = opUnion.colsOutput[i];
	    propsDistinct.columns.push(colname);
	    opDistinct.colsOutput.push(colname);
    }
    opDistinct.requiredChildProperties.push(propsDistinct);
    opDistinct.children.push(opUnion);

    return opDistinct;
}

function buildDataSource_TABLE(tableMetadata, source) {
    var opTable = buildTableOperator(tableMetadata, source.table, source.alias);

    return opTable;
}


function buildTableOperator(tableMetadata, tablename, alias) {
    var md = Storage.getTableMetadata(tablename);
    if (md == null) {
	throw "Unknown table: " + tablename;
    }

    var ti = new TableInfo(tablename, alias);
    for (var c=0; c<md.columns.length; c++) {
	var ci = new ColumnInfo(md.columns[c].name);
	ci.type = 'int';
	//console.log("buildTableOperator: col = " + ci.name);
	ti.columns.push(ci);
    }
    tableMetadata.push(ti);

    return new Operators.TableRead(tablename, alias, md.columns);
}

function buildJoinCondition(opJoin, opTableLeft, opTableRight, cond) {
    //console.log("buildJoinCondition: cond.left=" + cond.left);
    //console.log("buildJoinCondition: cond.operator=" + cond.operator);
    //console.log("buildJoinCondition: cond.right=" + cond.right);

    //console.log("AST mydump opTableLeft " + mydump(opTableLeft));
    //console.log("AST dumpObj opTableLeft " + dumpObj(opTableLeft));
    //console.log("AST mydump opTableRight " + mydump(opTableRight));
    //console.log("AST dumpObj opTableRight " + dumpObj(opTableRight));

    if (cond.operator == "=") {
	opJoin.condition = cond.operator;
    } else if (cond.operator == "!=") {
	opJoin.condition = cond.operator;
    } else if (cond.operator == "<>") {
	opJoin.condition = "!=";
    } else {
	throw "Unsupported join condition operator '" + cond.operator + "'";
    }

    var tableOne;
    var columnOne;
    var tableTwo;
    var columnTwo;
    if (cond.left.indexOf(".") > 0) {
	var parts = cond.left.split(".");
	if (parts.length != 2) {
	    throw "invalid join condition column name " + cond.left;
	}
	tableOne = parts[0];
	columnOne = parts[1];
    } else {
	tableOne = null;
	columnOne = cond.left;
    }
    if (cond.right.indexOf(".") > 0) {
	var parts = cond.right.split(".");
	if (parts.length != 2) {
	    throw "invalid join condition column name " + cond.right;
	}
	tableTwo = parts[0];
	columnTwo = parts[1];
    } else {
	tableTwo = null;
	columnTwo = cond.right;
    }

    opJoin.predicateLeftIndex = -1;
    opJoin.predicateRightIndex = -1;
    //console.log("buildJoinCondition: tableOne = " + tableOne);
    //console.log("buildJoinCondition: tableTwo = " + tableTwo);
    //console.log("buildJoinCondition: columnOne = " + columnOne);
    //console.log("buildJoinCondition: columnTwo = " + columnTwo);

    var tableMatchedLeft = -1;
    var tableMatchedRight = -1;
    if (tableOne) {
	if (tableOne == opTableLeft.name || tableOne == opTableLeft.alias) {
	    //console.log("buildJoinCondition: tableOne matched left");
	    tableMatchedLeft = 1;
	} else if (tableOne == opTableRight.name || tableOne == opTableRight.alias) {
	    //console.log("buildJoinCondition: tableOne matched right");
	    tableMatchedRight = 1;
	} else {
	    throw "Unknown table reference '" + tableOne + "'";
	}
    }
    if (tableTwo) {
	if (tableTwo == opTableLeft.name || tableTwo == opTableLeft.alias) {
	    //console.log("buildJoinCondition: tableTwo matched left");
	    tableMatchedLeft = 2;
	} else if (tableTwo == opTableRight.name || tableTwo == opTableRight.alias) {
	    //console.log("buildJoinCondition: tableTwo matched right");
	    tableMatchedRight = 2;
	} else {
	    throw "Unknown table reference '" + tableTwo + "'";
	}
    }

    // ---- resolve ColumnOne
    if (tableMatchedLeft == 1) {
	for (var i=0; i<opTableLeft.colsOutput.length; i++) {
	    //console.log("buildJoinCondition: columnOne = " + columnOne + " opTableLeft.cols = " + opTableLeft.colsOutput[i]);
	    if (columnOne == opTableLeft.colsOutput[i]) {
		opJoin.predicateLeftIndex = i;
		break;
	    }
	}
    } else if (tableMatchedRight == 1) {
	for (var i=0; i<opTableRight.colsOutput.length; i++) {
	    //console.log("buildJoinCondition: columnOne = " + columnOne + " opTableRight.cols = " + opTableRight.colsOutput[i]);
	    if (columnOne == opTableRight.colsOutput[i]) {
		opJoin.predicateRightIndex = i;
		break;
	    }
	}
    } else {
	// search both tables for columnOne
	var foundMatch = false;
	for (var i=0; i<opTableLeft.colsOutput.length; i++) {
	    //console.log("buildJoinCondition: columnOne = " + columnOne + " opTableLeft.cols = " + opTableLeft.colsOutput[i]);
	    if (columnOne == opTableLeft.colsOutput[i]) {
		foundMatch = true;
		opJoin.predicateLeftIndex = i;
		break;
	    }
	}
	if (opJoin.predicateLeftIndex < 0) {
	    for (var i=0; i<opTableRight.colsOutput.length; i++) {
		//console.log("buildJoinCondition: columnOne = " + columnOne + " opTableLeft.cols = " + opTableLeft.colsOutput[i]);
		if (columnOne == opTableRight.colsOutput[i]) {
		    if (foundMatch != false) {
			// oops, found same column name in both tables
			throw "Ambiguous join predicate, column = '" + columnOne + "'";
		    }
		    opJoin.predicateRightIndex = i;
		    break;
		}
	    }
	}
    }

    // ---- resolve ColumnTwo
    if (tableMatchedLeft == 2 && opJoin.predicateLeftIndex < 0) {
	for (var i=0; i<opTableLeft.colsOutput.length; i++) {
	    //console.log("buildJoinCondition: columnTwo = " + columnTwo + " opTableLeft.cols = " + opTableLeft.colsOutput[i]);
	    if (columnTwo == opTableLeft.colsOutput[i]) {
		opJoin.predicateLeftIndex = i;
		break;
	    }
	}
    } else if (tableMatchedRight == 2 && opJoin.predicateRightIndex < 0) {
	for (var i=0; i<opTableRight.colsOutput.length; i++) {
	    //console.log("buildJoinCondition: columnTwo = " + columnTwo + " opTableRight.cols = " + opTableRight.colsOutput[i]);
	    if (columnTwo == opTableRight.colsOutput[i]) {
		opJoin.predicateRightIndex = i;
		break;
	    }
	}
    } else {
	// search both tables for columnTwo
	var foundMatch = false;
	if (opJoin.predicateLeftIndex < 0) {
	    for (var i=0; i<opTableLeft.colsOutput.length; i++) {
		//console.log("buildJoinCondition: columnTwo = " + columnTwo + " BOTH opTableLeft.cols = " + opTableLeft.colsOutput[i]);
		if (columnTwo == opTableLeft.colsOutput[i]) {
		    foundMatch = true;
		    opJoin.predicateLeftIndex = i;
		    break;
		}
	    }
	}
	if (opJoin.predicateRightIndex < 0) {
	    for (var i=0; i<opTableRight.colsOutput.length; i++) {
		//console.log("buildJoinCondition: columnTwo = " + columnTwo + " BOTH opTableRight.cols = " + opTableRight.colsOutput[i]);
		if (columnTwo == opTableRight.colsOutput[i]) {
		    if (foundMatch != false) {
			// oops, found same column name in both tables
			throw "Ambiguous join predicate, column = '" + columnTwo + "'";
		    }
		    opJoin.predicateRightIndex = i;
		    break;
		}
	    }
	}
    }

    if (opJoin.predicateLeftIndex == -1) {
	throw "Unmatched table predicate (left)";
    }
    
    if (opJoin.predicateRightIndex == -1) {
	throw "Unmatched table predicate (right)";
    }
}


function buildCrossJoinCondition(opJoin, opTableLeft, opTableRight, cond) {
    opJoin.condition = '?';
    opJoin.predicateLeftIndex = 0;
    opJoin.predicateRightIndex = 0;
}


function extractField(field, tableMetadata, op, props) {
    if (field == "*") {
	// expand the * to be all columns received from child
	for (var i=0; i<op.children[0].colsOutput.length; i++) {
	    op.colsOutput.push(op.children[0].colsOutput[i]);
	    props.columns.push(op.children[0].colsOutput[i]);
	}
	return '*';
    } else if (field.indexOf(".") > 0) {
	var parts = field.split(".");
	if (parts.length != 2) {
	    throw "invalid column name " + field;
	}
	for (var t=0; t<tableMetadata.length; t++) {
	    //console.log("term's table prefix = " + parts[0] + " table = " + tableMetadata[t].name);
	}
	op.colsOutput.push(field)
	props.columns.push(parts[1]);
	return 't';
    } else {
	var matchCount = 0;
	for (var t=0; t<tableMetadata.length; t++) {
	    //console.log("term's table = " + tableMetadata[t].name);
	    for (var c=0; c<tableMetadata[t].columns.length; c++) {
		//console.log("extractField: field = " + field + " table child = " + tableMetadata[t].columns[c].name);
		if (field == tableMetadata[t].columns[c].name) {
		    matchCount += 1;
		}
	    }
	}
	if (matchCount == 0) {
	    throw "extractField: unknown column : " + field;
	} else if (matchCount > 1) {
	    throw "extractField: ambiguous column name : " + field;
	}

	op.colsOutput.push(field);
	props.columns.push(field);
	return 't';
    }
}


function extractFunction(field, op, props) {
    var opAgg = new Operators.Aggregate();
    var propsAgg = new Operators.Properties();
    opAgg.aggregateFunction = field.func;
    opAgg.requiredChildProperties.push(propsAgg);
    opAgg.children.push(op.children[0]);
    op.children[0] = opAgg;
    
    if (field.param == "*") {
	// SQL sucks! count(*) should be on result group, not a field
	// the grammar should catch, but double-check here
	if (field.func != "COUNT") {
	    throw "Only the COUNT function can use star here";
	}
	if (field.alias) {
	    op.colsOutput.push(field.alias);
	} else {
	    op.colsOutput.push("COUNT(*)");
	}
	props.columns.push("COUNT(*)");
	opAgg.colsOutput.push("COUNT(*)");
	// hack -- grab first column from child to use for count
	propsAgg.columns.push(opAgg.children[0].colsOutput[0]);
    } else if (field.param.indexOf(".") > 0) {
	var parts = field.split(".");
	if (parts.length != 2) {
	    throw "invalid column name " + field.field;
	}
	var matchCount = 0;
	var idx = 0;
	for (var i=0; i<opAgg.children[0].colsOutput.length; i++) {
	    if (parts[1] == opAgg.children[0].colsOutput[i]) {
		idx = i;
		matchCount += 1;
	    }
	}
	if (matchCount == 0) {
	    throw "unknown column in function : " + field.param;
	} else if (matchCount > 1) {
	    throw "ambiguous column name in function : " + field.param;
	}
	if (field.alias) {
	    op.colsOutput.push(field.alias);
	} else {
	    op.colsOutput.push(field.func + "()");
	}
	props.columns.push(field.func + "()");
	opAgg.colsOutput.push(field.func + "()");
	opAgg.aggregateIndex = 0;
	propsAgg.columns.push(opAgg.children[0].colsOutput[idx]);
    } else {
	var matchCount = 0;
	var idx = 0;
	for (var i=0; i<opAgg.children[0].colsOutput.length; i++) {
	    //console.log("extractFunction: field = " + field.param + " child col = " + opAgg.children[0].colsOutput[i]);
	    if (field.param == opAgg.children[0].colsOutput[i]) {
		//console.log("extractFunction: FOUND field = " + field.param + " AT " + i);
		idx = i;
		matchCount += 1;
	    }
	}
	if (matchCount == 0) {
	    throw "Unknown column in function : " + field.param;
	} else if (matchCount > 1) {
	    throw "ambiguous column name in function : " + field.param;
	}
	if (field.alias) {
	    op.colsOutput.push(field.alias);
	} else {
	    op.colsOutput.push(field.func + "()");
	}
	props.columns.push(field.func + "()");
	opAgg.colsOutput.push(field.func + "()");
	propsAgg.columns.push(opAgg.children[0].colsOutput[idx]);
	opAgg.aggregateIndex = 0;
    }
}


function WhereOp(op) {
  this.operator = op;
  this.left = null;
  this.right = null;
}

function buildWhereTree(tableMetadata, node) {
    //console.log("buildWhereTree node=" + typeof node);
    if (node.hasOwnProperty("operator") ) {
	//console.log("buildWhereTree node op=" + node.operator);
	var wop = new WhereOp(node.operator);
	switch (node.operator) {
	case "AND":
	    wop.left = new buildWhereTree(tableMetadata, node.left);
	    wop.right = new buildWhereTree(tableMetadata, node.right);
	    break;
	case "OR":
	    wop.left = new buildWhereTree(tableMetadata, node.left);
	    wop.right = new buildWhereTree(tableMetadata, node.right);
	    break;
	case "+": case "-": case "*": case "/":
	case ">": case "<": case "=": case "!=":
	case "<=>": case ">=": case "<=":
	    wop.left = new buildWhereTree(tableMetadata, node.left);
	    wop.right = new buildWhereTree(tableMetadata, node.right);
	    break;
	case "BETWEEN": case "NOTBETWEEN":
	    wop.left = new buildWhereTree(tableMetadata, node.left);
	    wop.right = { "low" : node.rangeLow, "high" : node.rangeHigh };
	    break;
	case "IN": case "NOTIN":
	case "ISNULL": case "ISNOTNULL":
	    wop.left = new buildWhereTree(tableMetadata, node.left);
	    break;
	case "LIKE": case "NOTLIKE":
	    wop.left = new buildWhereTree(tableMetadata, node.left);
	    wop.right = { "colnum" : -1, "value" : node.right };
	    break;
	default:
	    console.log("buildWhereTree: unknown operator " + node.operator);
	    return null;
        }
    } else {
	//console.log("buildWhereTree: (non-string) node = " + node);
	if (typeof node !== "string") {
	    return { "colnum": -1, "value": node };
	}
	//console.log("buildWhereTree: node is STRING " + node);
	if (node == "null") {
	    return { "colnum": -1, "value": node };
	}
	if (node.charAt(0) == "'") {
	    //console.log("buildWhereTree:  string= " + node);
	    // trim off the quotes
	    var last = node.length - 1;
	    node = node.slice(1, last);
	    //console.log("buildWhereTree: node string= " + node);
	    return { "colnum": -1, "value": node };
	}
	// check if name in list of known names
	console.log("buildWhereTree: checking name = " + node);
	var tableName = null;
	var columnName = null;
	if (node.indexOf(".") > 0) {
	    var parts = node.split(".");
	    if (parts.length != 2) {
		throw "invalid where-clause name " + node;
	    }
	    tableName = parts[0];
	    columnName = parts[1];
	} else {	
	    columnName = node;
	}

	var matchCount = 0;
	var colnum = -1;
	for (var t=0; t<tableMetadata.length; t++) {
	    console.log("buildWhereTree: table, name = " + tableMetadata[t].name + " alias = " + tableMetadata[t].alias);
	    if ((tableMetadata.length == 1 && tableName == null) || tableName == tableMetadata[t].name || tableName == tableMetadata[t].alias) {
		console.log("buildWhereTree: found table for " + tableName);
		for (var c=0; c<tableMetadata[t].columns.length; c++) {
		    console.log("buildWhereTree: col name = " + tableMetadata[t].columns[c].name);
		    if (columnName == tableMetadata[t].columns[c].name) {
			console.log("buildWhereTree: found columnName = " + columnName);
			colnum = c;
			matchCount += 1;
		    }
		}
	    }
	}

	if (matchCount == 0) {
	    if (tableName == null) {
		throw "where-clause name '"  + node + "' did not match tables";
	    } else {
		throw "where-clause name '"  + columnName + "' did not match table '" + tableName + "'";
	    }
	} else if (matchCount > 1) {
	    throw "ambiguous where-clause name, '" + node + "' matched multiple tables";
	} else {
	    return {
		"colnum" : colnum,
		"value" : columnName,
	    };
	}
    }
    return wop;
}

function parseGroupByClause(opSelect, tableMetadata, groupByAST) {
    groupings = [];
    for (var i=0; i<groupByAST.length; i++) {
	console.log("GROUP BY " + groupByAST[i].ident);
	var group = { "col": groupByAST[i].ident,
		      "dir": groupByAST[i].direction
		    };
	groupings.push(group);
    }
    opSelect.groupings = groupings;
}

function buildOrderBy(op, orderby) {
    //console.log("==== ORDER BY " + orderby.arg + " "  + orderby.direction);
    var idx = -1;

    var opSort = new Operators.Sort();
    opSort.sortDirection = orderby.direction;
    var propsSort = new Operators.Properties();
    for (var i=0; i<op.colsOutput.length; i++) {
	var colname = op.colsOutput[i];
	opSort.colsOutput.push(colname);
	propsSort.columns.push(colname);
	if (orderby.arg == colname) {
	    //console.log("==== ORDER BY " + orderby.arg + " col = " + i);
	    idx = i;
	}
    }
    if (idx < 0) {
	throw "Unknown column for ordering " + orderby.arg;
    }
    opSort.sortColumn = idx;
    opSort.requiredChildProperties.push(propsSort);
    opSort.children[0] = op.children[0];
    op.children[0] = opSort;
}

//-----------------------------------------------------------

function mydump(arr, level) {
    var dumped_text = "";
    if (!level) level = 0;

    var level_padding = "";
    for (var j=0;j<level+1;j++) level_padding += "    ";

    if (typeof(arr) == "object") {  
        for (var item in arr) {
            var value = arr[item];
            if (typeof(value) == "object") { 
                dumped_text += level_padding + "'" + item + "' ...\n";
                dumped_text += mydump(value, level+1);
            } else {
                dumped_text += level_padding + "'" + item + "' => \"" + value + "\"\n";
            }
        }
    } else {
        dumped_text = "===>"+arr+"<===("+typeof(arr)+")";
    }
    return dumped_text;
}

var MAX_DUMP_DEPTH = 10;
function dumpObj(obj, name, indent, depth) {
    if (depth > MAX_DUMP_DEPTH) {
        return indent + name + ": <Maximum Depth Reached>\n";
    }
    if (typeof obj == "object") {
        var child = null;
        var output = indent + name + "\n";
        indent += "\t";
        for (var item in obj)
        {
            try {
                child = obj[item];
            } catch (e) {
                child = "<Unable to Evaluate>";
            }
            if (typeof child == "object") {
                output += dumpObj(child, item, indent, depth + 1);
            } else {
                output += indent + item + ": " + child + "\n";
            }
        }
        return output;
    } else {
        return obj;
    }
}
