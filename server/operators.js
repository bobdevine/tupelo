const Storage = require("./storage");

//const SHOW_COLUMNS = false;
const SHOW_COLUMNS = true;

// could use a superclass/subclass design
// (ECMAscript 2015 has "class" + "extend"; inheritFrom is nonstandard)
// But ... each operator is quite different,
// so a superclass would be nearly useless
//function BaseOperator() { console.log("BaseOperator"); }

exports.Properties = function() {
    this.columns = [];
    //this.sortOrder = null;
}

//--------------------------------------------------------
// Fundamental Operations
//
//    SELECT -> σ (sigma)
//    PROJECT -> π (pi)
//    UNION -> ∪ (cup)
//    SET DIFFERENCE -> - (minus)
//    CARTESIAN PRODUCT -> ×(times)
//    RENAME -> ρ (rho)
//
// Select and project operations are unary operation.
// Union, set difference, Cartesian product, and rename operations are binary.
//
// SELECT: identify a set of tuples which is a part of a relation and to extract only these tuples out. The select operation selects tuples that satisfy a given predicate or condition.
// SELECT is used to obtain a subset of the tuples of a relation that satisfy a select condition. 
//
// PROJECT: returns its argument relation with certain attributes left out.
// The PROJECT operation is used to select a subset of the attributes of a relation by specifying the names of the required attributes.
// Duplicates might be dropped.
//
// UNION: the union of two relations is a relation that includes all the tuples that are either in R or in S or in both R and S. Duplicate tuples might be eliminated.
//
// SET DIFFERENCE: finds tuples in one relation but not in other.
// The difference of R and S is the relation that contains all the tuples that are in R but that are not in S. 
//
// CARTESIAN PRODUCT: combines information from two relations.
// It combines the tuples of one relation with all the tuples of the other relation. 
//
// RENAME: returns an existing relation/entity under a new name.
// Rename renames the relationship and its attributes.
// It doesn’t alter the relationship’s content
//
// Derivable Operations
//
//    SET INTERSECTION -> ∩(cap)
//    JOIN -> |×| (bow-tie)
//    OUTER JOIN
//    DIVISION
//    ASSIGNMENT
//
// SET INTERSECTION: finds tuples in both the relations. The intersection
// of R and S is a relation that includes all tuples that are both in R and S. 
//
// JOIN: is a binary operation and a combination of certain
// selections and a Cartesian product into one operation.
// JOIN allows you to evaluate a join condition between the attributes of the relations on which the join is undertaken. 
//
// OUTER JOIN:  outer join retains the information that would have been lost from the tables, replacing missing data with nulls.
//
// There are three forms of the outer join, depending on which data is to be kept.
//    LEFT OUTER JOIN - keep data from the left-hand table
//    RIGHT OUTER JOIN - keep data from the right-hand table
//    FULL OUTER JOIN - keep data from both tables
//
// DIVISION / QUOTIENT :

//-------------------------------------------------

// DISPLAY operator handles grouping and output formatting
exports.Display = function() {
    this.colsOutput = [];
    this.requiredChildProperties = [];
    this.children = [];
}
exports.Display.prototype.addChild = function(op) {
    if (this.children.length > 0) {
        throw "Display node already has a child";
    }
    this.children.push(op);
}
exports.Display.prototype.getCost = function() {
    var cost = 1;
    if (this.children > 0) {
        cost += this.children[0].getCost();
    }
    return cost;
}
exports.Display.prototype.getOperatorName= function() {
    return '[Display]';
}
exports.Display.prototype.printTree = function() {
    console.log(this.getOperatorName());
    if (SHOW_COLUMNS) {
        for (var i=0; i<this.colsOutput.length; i++) {
            console.log("  Col OUT " + this.colsOutput[i]);
        }
        for (var i=0; i<this.requiredChildProperties[0].columns.length; i++) {
            console.log("  REQ Col " + this.requiredChildProperties[0].columns[i]);
        }
    }
    if (this.children.length > 0) {
        this.children[0].printTree();
    }
}
exports.Display.prototype.exec = function() {
    //console.log("DISPLAY EXEC len=" + this.colsOutput.length);
    var rows = this.children[0].exec();
    //console.log("==== DISPLAY ROWS ====\n" + ' ' + rows);
    if (rows.length && rows[0].length != this.colsOutput.length) {
        throw "Malformed query, output columns != expected (" + rows[0].length + " != " + this.colsOutput.length + ")";
    }

    var answer = { 'headers' : [], 'rows' : [] };
    for (var i=0; i<this.colsOutput.length; i++) {
        var colname = this.colsOutput[i];
        answer.headers.push(colname);
    }
    for (var i=0; i<rows.length; i++) {
        answer.rows.push(rows[i]);
    }

    return JSON.stringify(answer);
}

//-------------------------------------------------

exports.Select = function() {
    this.colsOutput = [];
    this.requiredChildProperties = [];
    this.children = [];
    this.evalTree = null;
}
exports.Select.prototype.addChild = function(op) {
    //console.log("Select addChild");
    if (this.children.length > 0) {
        throw "Select node already has a child";
    }
    this.children.push(op);
}
exports.Select.prototype.getCost = function() {
    var cost = 2;
    if (this.children.length > 0) {
        cost += this.children[0].getCost();
    }
    return cost;
}
exports.Select.prototype.getOperatorName= function() {
    return '[Select]';
}
exports.Select.prototype.printTree = function() {
    console.log(this.getOperatorName());
    if (SHOW_COLUMNS) {
        for (var i=0; i<this.colsOutput.length; i++) {
            console.log("  Col OUT " + this.colsOutput[i]);
        }
        for (var i=0; i<this.requiredChildProperties[0].columns.length; i++) {
            console.log("  REQ Col " + this.requiredChildProperties[0].columns[i]);
        }
    }
    if (this.children.length > 0) {
        this.children[0].printTree();
    }
}
exports.Select.prototype.exec = function() {
    //console.log("Select exec");
    if (this.children.length == 0) {
        return [];
    }
    var rowsRaw = this.children[0].exec();
    //console.log("==== SELECT ROWS IN ====\n" + ' ' + rowsRaw);
    
    // filter the selection
    var rowsSelect = [];
    for (var r=0; r<rowsRaw.length; r++) {
        if (rowFilter(this.evalTree, rowsRaw[r])) {
            rowsSelect.push(rowsRaw[r]);
        }
    }
    return rowsSelect;
}


function rowFilter(evalTree, row) {
    if (!evalTree) {
        return true;
    }
    if (evalTree.hasOwnProperty('colnum') ) {
        if (evalTree.colnum == -1) {
            //console.log("rowFilter: value = " + evalTree.value);
            return evalTree.value;
        } else {
            //console.log("rowFilter: colnum = " + evalTree.colnum);
            //console.log("rowFilter: row[colnum] = " + row[evalTree.colnum]);
            return row[evalTree.colnum];
        }
    }
    //console.log("evalTree.operator ='" + evalTree.operator + "'");
    switch (evalTree.operator) {
    case 'AND':
        return rowFilter(evalTree.left, row) && rowFilter(evalTree.right, row);
    case 'OR':
        return rowFilter(evalTree.left, row) || rowFilter(evalTree.right, row);

    case '+':
        return rowFilter(evalTree.left, row) + rowFilter(evalTree.right, row);
    case "-":
        return rowFilter(evalTree.left, row) - rowFilter(evalTree.right, row);
    case "*":
        return rowFilter(evalTree.left, row) * rowFilter(evalTree.right, row);
    case "/":
        return rowFilter(evalTree.left, row) / rowFilter(evalTree.right, row);
    case '>':
        return rowFilter(evalTree.left, row) > rowFilter(evalTree.right, row);
    case '<':
        return rowFilter(evalTree.left, row) < rowFilter(evalTree.right, row);
    case '=':
        return rowFilter(evalTree.left, row) == rowFilter(evalTree.right, row);
    case '!=':
        return rowFilter(evalTree.left, row) != rowFilter(evalTree.right, row);
    case '<=>':
        // Unlike the regular =, <=> does a NULL-tolerant comparison
        // "NULL = NULL" yields NULL, but "NULL <=> NULL" yields true
        // Note: '<=>' is not accepted by all SQL versions
        return rowFilter(evalTree.left, row) == rowFilter(evalTree.right, row);
    case '>=':
        return rowFilter(evalTree.left, row) >= rowFilter(evalTree.right, row);
    case '<=':
        return rowFilter(evalTree.left, row) <= rowFilter(evalTree.right, row);
    case 'BETWEEN':
        var val = rowFilter(evalTree.left, row);
        return (val >= evalTree.right.low) && (val <= evalTree.right.high);
    case 'NOTBETWEEN':
        var val = rowFilter(evalTree.left, row);
        return (val < evalTree.right.low) || (val > evalTree.right.high);
    case 'IN':
        // TODO
        return false;
    case 'NOTIN':
        // TODO
        return false;
    case 'ISNULL':
        return rowFilter(evalTree.left, row) == null;
    case 'ISNOTNULL':
        return rowFilter(evalTree.left, row) != null;
    case 'LIKE':
        var val = rowFilter(evalTree.left, row);
        var pat = rowFilter(evalTree.right, row);
        return likeFunc(val, pat);
    case 'NOTLIKE':
        var val = rowFilter(evalTree.left, row);
        var pat = rowFilter(evalTree.right, row);
        return (! likeFunc(val, pat));
    default:
        console.log("rowFilter: unknown operator " + evalTree.operator);
        return true;
    }
};

function likeFunc(str, pattern) {
    //console.log("likeFunc: str =" + str);
    //console.log("likeFunc: pattern =" + pattern);
    if (typeof str !== 'string') {return false; }
    if (typeof pattern !== 'string') {return false; }
    // Remove quotes and special chars
    var last = pattern.length - 1;
    pattern = pattern.slice(1, last);
    pattern = pattern.replace(new RegExp("([\\.\\\\\\+\\*\\?\\[\\^\\]\\$\\(\\)\\{\\}\\=\\!\\<\\>\\|\\:\\-])", "g"), "\\$1");
    // Replace % and _ with equivalent regex
    pattern = pattern.replace(/%/g, '.*').replace(/_/g, '.');
    // Check matches
    return RegExp('^' + pattern + '$', 'gi').test(str);
}

//-------------------------------------------------

exports.Project = function() {
    this.colsOutput = [];
    this.requiredChildProperties = [];
    this.filter = null;
    this.children = [];
}
exports.Project.prototype.addChild = function(op) {
    if (this.children.length > 0) {
        throw "Project node already has a child";
    }
    this.children[0].push(op);
}
exports.Project.prototype.getCost = function() {
    var cost = 2;
    if (this.children.length > 0) {
        cost += this.children[0].getCost();
    }
    return cost;
}
exports.Project.prototype.getOperatorName= function() {
    return '[Project]';
}
exports.Project.prototype.printTree = function() {
    console.log(this.getOperatorName());
    if (SHOW_COLUMNS) {
        for (var i=0; i<this.colsOutput.length; i++) {
            console.log("  Col OUT " + this.colsOutput[i]);
        }
        for (var i=0; i<this.requiredChildProperties[0].columns.length; i++) {
            console.log("  REQ Col " + this.requiredChildProperties[0].columns[i]);
        }
    }
    if (this.children.length > 0) {
        this.children[0].printTree();
    }
}
exports.Project.prototype.exec = function() { 
    //console.log("Project exec");
    if (this.children.length == 0) {
        return [];
    }
    var rowsRaw = this.children[0].exec();
    //console.log("==== PROJECT ROWS IN ====\n" + ' ' + rowsRaw);

    var rowsProject = [];
    // TODO: use map()?
    //console.log("====PROJECT: filter=" + this.filter);
    for (var r=0; r<rowsRaw.length; r++) {
        //console.log("====PROJECT: ROW RAW====\n" + ' ' + rowsRaw[r]);
        var newRow = [];
        for (var f=0; f<this.filter.length; f++) {
            var colIndex = this.filter[f];
            newRow.push(rowsRaw[r][colIndex]);
        }
        //console.log("====PROJECT: NEW ROW====\n" + ' ' + newRow);
        rowsProject.push(newRow);
    }
    //console.log("====ROWS====\n" + ' ' + rowsProject);
    return rowsProject;
}

//-------------------------------------------------

// Delete op is a top-level op, like Display
exports.Delete = function() {
    this.colsOutput = [];
    this.requiredChildProperties = [];
    this.children = [];
    this.evalTree = null;
    this.newValues = [];
}
exports.Delete.prototype.addChild = function(op) {
    //console.log("Delete addChild");
    if (this.children.length > 0) {
        throw "Delete node already has a child";
    }
    this.children.push(op);
}
exports.Delete.prototype.getCost = function() {
    var cost = 2;
    if (this.children.length > 0) {
        cost += this.children[0].getCost();
    }
    return cost;
}
exports.Delete.prototype.getOperatorName= function() {
    return '[Delete]';
}
exports.Delete.prototype.printTree = function() {
    console.log(this.getOperatorName());
    if (SHOW_COLUMNS) {
        for (var i=0; i<this.colsOutput.length; i++) {
            console.log("  Col OUT " + this.colsOutput[i]);
        }
        for (var i=0; i<this.requiredChildProperties[0].columns.length; i++) {
            console.log("  REQ Col " + this.requiredChildProperties[0].columns[i]);
        }
    }
    if (this.children.length > 0) {
        this.children[0].printTree();
    }
}
exports.Delete.prototype.exec = function() {
    //console.log("Delete exec");
    if (this.children.length == 0) {
        return [];
    }
    var rows = this.children[0].exec();
    //console.log("==== DELETE **IN** ====\n" + ' ' + rows);
    
    // filter the delete list
    var rowsKept = [];
    var rowCount = 0;
    for (var r=0; r<rows.length; r++) {
        if (this.evalTree == null) {
            //console.log("DELETE: no filter");
            rowCount += 1;
        } else if (rowFilter(this.evalTree, rows[r])) {
            //console.log("DELETE: filter matched ====\n" + rows[r]);
            rowCount += 1;
        } else {
            rowsKept.push(rows[r]);
        }
    }

    //console.log("==== DELETE ** OUT ** ====\n" + ' ' + rowsKept);
        
    Storage.tableWrite(this.tablename, rowsKept);

    if (rowCount == 0) {
        return "<br>Deleted 0 rows";
    } else if (rowCount == 1) {
        return "<br>Deleted 1 row";
    } else {
        return "<br>Deleted " + rowCount + " rows";
    }
}

//-------------------------------------------------

// Update op is a top-level op, like Display
exports.Update = function() {
    this.colsOutput = [];
    this.requiredChildProperties = [];
    this.children = [];
    this.evalTree = null;
    this.newValues = [];
}
exports.Update.prototype.addChild = function(op) {
    //console.log("Update addChild");
    if (this.children.length > 0) {
        throw "Update node already has a child";
    }
    this.children.push(op);
}
exports.Update.prototype.getCost = function() {
    var cost = 2;
    if (this.children.length > 0) {
        cost += this.children[0].getCost();
    }
    return cost;
}
exports.Update.prototype.getOperatorName= function() {
    return '[Update]';
}
exports.Update.prototype.printTree = function() {
    console.log(this.getOperatorName());
    if (SHOW_COLUMNS) {
        for (var i=0; i<this.colsOutput.length; i++) {
            console.log("  Col OUT " + this.colsOutput[i]);
        }
        for (var i=0; i<this.requiredChildProperties[0].columns.length; i++) {
            console.log("  REQ Col " + this.requiredChildProperties[0].columns[i]);
        }
    }
    if (this.children.length > 0) {
        this.children[0].printTree();
    }
}
exports.Update.prototype.exec = function() {
    //console.log("Update exec");
    if (this.children.length == 0) {
        return [];
    }
    var rows = this.children[0].exec();
    //console.log("==== UPDATE ROWS **IN** ====\n" + ' ' + rows);
    
    // filter the update list
    var rowCount = 0;
    for (var r=0; r<rows.length; r++) {
        if (rowFilter(this.evalTree, rows[r])) {
            //console.log("UPDATE: filter matched ====\n" + rows[r]);
            rowCount += 1;
            for (var v=0; v<this.newValues.length; v++) {
                var colname = this.newValues[v].col;
                //console.log("col = " + colname + " val = " + this.newValues[v].val);
                for (var c=0; c<this.requiredChildProperties[0].columns.length; c++) {
                    if (colname == this.requiredChildProperties[0].columns[c]) {
                        rows[r][c] = this.newValues[v].val;
                    }
                }
            }
        }
    }

    //console.log("==== UPDATE ROWS ** OUT ** ====\n" + ' ' + rows);
        
    Storage.tableWrite(this.tablename, rows);

    if (rowCount == 0) {
        return "<br>Updated 0 rows";
    } else if (rowCount == 1) {
        return "<br>Updated 1 row";
    } else {
        return "<br>Updated " + rowCount + " rows";
    }
}

//-------------------------------------------------

exports.Union = function() {
    this.colsOutput = [];
    this.requiredChildProperties = [];
    this.children = [];
}
exports.Union.prototype.getCost = function() {
    var cost = 3;
    for (var c=0; c<this.children.length; c++) {
        cost += this.children[c].getCost();
    }
    return cost;
}
exports.Union.prototype.addChild = function(op) {
    if (this.children.length == 2) {
        throw "Union operator already has two children";
    }
    this.children.push(op);
}
exports.Union.prototype.getOperatorName= function() {
    return '[Union]';
}
exports.Union.prototype.printTree = function() {
    console.log(this.getOperatorName());
    if (SHOW_COLUMNS) {
        for (var i=0; i<this.colsOutput.length; i++) {
            console.log("  Col " + i + " OUT " + this.colsOutput[i]);
        }
        for (var i=0; i<this.requiredChildProperties.length; i++) {
            for (var j=0; j<this.requiredChildProperties[i].columns.length; j++) {
                console.log("  REQ Col[" + i + ',' + j + "] " + this.requiredChildProperties[i].columns[j]);
            }
        }
    }
    for (var c=0; c<this.children.length; c++) {
        this.children[c].printTree();
    }
}
exports.Union.prototype.exec = function() {
    var rowsLeft = this.children[0].exec();
    var rowsRight = this.children[1].exec();
    var rows = [];

    for (var l=0; l<rowsLeft.length; l++) {
        //console.log("====ROW LEFT====\n" + ' ' + rowsLeft[l]);
        rows.push(rowsLeft[l]);
    }
    for (var r=0; r<rowsRight.length; r++) {
        //console.log("====ROW RIGHT====\n" + ' ' + rowsRight[r]);
        rows.push(rowsRight[r]);
    }
    //console.log("====ROWS====\n" + ' ' + rows);
    return rows;
}

//-------------------------------------------------

exports.SetDifference = function() {
    this.colsOutput = [];
    this.requiredChildProperties = [];
    this.children = [];
}
exports.SetDifference.prototype.getCost = function() {
    var cost = 3;
    for (var c=0; c<this.children.length; c++) {
        cost += this.children[c].getCost();
    }
    return cost;
}
exports.SetDifference.prototype.getOperatorName= function() {
    return '[SetDifference]';
}
exports.SetDifference.prototype.printTree = function() {
    console.log(this.getOperatorName() + ' #children=' + this.children.length);
    if (SHOW_COLUMNS) {
        for (var i=0; i<this.colsOutput.length; i++) {
            console.log("  Col " + i + " OUT " + this.colsOutput[i]);
        }
        for (var i=0; i<this.requiredChildProperties.length; i++) {
            for (var j=0; j<this.requiredChildProperties[i].columns.length; j++) {
                console.log("  REQ Col[" + i + ',' + j + "] " + this.requiredChildProperties[i].columns[j]);
            }
        }
    }
    for (var c=0; c<this.children.length; c++) {
        console.log(this.children[c].printTree());
    }
}
exports.SetDifference.prototype.exec = function() { 
    console.log("SetDifference");
    var result = "SetDifference<br>";
    result += "SETDIFFERENCE";
    
    return result;
}

//-------------------------------------------------

exports.CartesianProduct = function() {
    this.colsOutput = [];
    this.requiredChildProperties = [];
    this.children = [];
}
exports.CartesianProduct.prototype.addChild = function(op) {
    this.children.push(op);
}
exports.CartesianProduct.prototype.getCost = function() {
    var cost = 4;
    for (var c=0; c<this.children.length; c++) {
        cost += this.children[c].getCost();
    }
    return cost;
}
exports.CartesianProduct.prototype.getOperatorName= function() {
    return '[CartesianProduct]';
}
exports.CartesianProduct.prototype.printTree = function() {
    console.log(this.getOperatorName());
    if (SHOW_COLUMNS) {
        for (var i=0; i<this.colsOutput.length; i++) {
            console.log("  Col " + i + " OUT " + this.colsOutput[i]);
        }
        for (var i=0; i<this.requiredChildProperties.length; i++) {
            for (var j=0; j<this.requiredChildProperties[i].columns.length; j++) {
                console.log("  REQ Col[" + i + ',' + j + "] " + this.requiredChildProperties[i].columns[j]);
            }
        }
    }
    for (var c=0; c<this.children.length; c++) {
        this.children[c].printTree();
    }
}
exports.CartesianProduct.prototype.exec = function() {
    if (this.children.length != 2) {
        throw "CartesianProduct does not have two children";
    }
    var rowsLeft = this.children[0].exec();
    //console.log("====ROWS LEFT====\n" + ' ' + rowsLeft);
    var rowsRight = this.children[1].exec();
    //console.log("====ROWS RIGHT====\n" + ' ' + rowsRight);
    var rowsJoin = [];
    // TODO: use map()?
    for (var l=0; l<rowsLeft.length; l++) {
        for (var r=0; r<rowsRight.length; r++) {
            //console.log("====ROW LEFT====\n" + ' ' + rowsLeft[l]);
            //console.log("====ROW RIGHT====\n" + ' ' + rowsRight[r]);
            var newRow = [];
            for (var i=0; i<rowsLeft[l].length; i++) {
                newRow.push(rowsLeft[l][i]);
            }
            for (var i=0; i<rowsRight[r].length; i++) {
                newRow.push(rowsRight[r][i]);
            }
            //console.log("====NEW ROW====\n" + ' ' + newRow);
            rowsJoin.push(newRow);
        }
    }
    //console.log("====ROWS====\n" + ' ' + rowsJoin);
    return rowsJoin;
}

//-------------------------------------------------

exports.TableRead = function(tablename, alias, columns) {
    this.tablename = tablename;
    this.alias = alias;
    this.colsOutput = [];
    this.children = []; // should always be empty
    for (var i=0; i<columns.length; i++) {
        //console.log("  - COL '" + columns[i].colname + "' added to op TableRead of " + this.tablename);
        this.colsOutput.push(columns[i].name);
    }
}
exports.TableRead.prototype.getCost = function() {
    var cost = 10;
    // get estimate of cardinality
    return cost;
}
exports.TableRead.prototype.getOperatorName= function() {
    return '[TableRead]';
}
exports.TableRead.prototype.printTree = function() {
    console.log(this.getOperatorName() + ' ' + this.tablename);
    if (SHOW_COLUMNS) {
        for (var i=0; i<this.colsOutput.length; i++) {
            console.log("  Col OUT " + this.colsOutput[i]);
        }
    }
}
exports.TableRead.prototype.exec = function() {
    var rows = Storage.getAllRows(this.tablename);
    //console.log("====ROWS====\n" + ' ' + rows);
    
    return rows;
}

//=============================================================


/*** Supported outer joins
 *   LEFT JOIN
 *     Return all rows from the left table, even if there are no matches in
 *     the right table. Fill in unmatched columns with NULLs.
 *   RIGHT JOIN
 *     Return all rows from the right table, even if there are no matches in
 *     the left table. Fill in unmatched columns with NULLs.
 *   FULL JOIN
 *     Return all rows from both tables, even if there are no matches.
 *     Fill in unmatched columns with NULLs.
****/
exports.OuterJoin = function(ojtype) {
    this.outerjointype = ojtype;
    this.condition = null;
    this.colsOutput = [];
    this.requiredChildProperties = [];
    this.children = [];
    this.condition = null;
    this.predicateLeftIndex;
    this.predicateRightIndex;
}
exports.OuterJoin.prototype.addChild = function(op) {
    this.children.push(op);
}
exports.OuterJoin.prototype.getCost = function() {
    var cost = 5;
    for (var c=0; c<this.children.length; c++) {
        cost += this.children[c].getCost();
    }
    return cost;
}
exports.OuterJoin.prototype.getOperatorName= function() {
    return '[OuterJoin]';
}
exports.OuterJoin.prototype.printTree = function() {
    console.log(this.getOperatorName());
    if (SHOW_COLUMNS) {
        for (var i=0; i<this.colsOutput.length; i++) {
            console.log("  Col " + i + " OUT " + this.colsOutput[i]);
        }
        for (var i=0; i<this.requiredChildProperties.length; i++) {
            for (var j=0; j<this.requiredChildProperties[i].columns.length; j++) {
                console.log("  REQ Col[" + i + ',' + j + "] " + this.requiredChildProperties[i].columns[j]);
            }
        }
    }
    for (var c=0; c<this.children.length; c++) {
        this.children[c].printTree();
    }
}
exports.OuterJoin.prototype.exec = function() {
    //console.log("OUTER JOIN TYPE = " + this.outerjointype);
    var rowsLeft = this.children[0].exec();
    //console.log("====ROWS LEFT====\n" + ' ' + rowsLeft);
    var rowsRight = this.children[1].exec();
    //console.log("====ROWS RIGHT====\n" + ' ' + rowsRight);
    var rowsJoin = [];
    if (this.outerjointype == "FULL") {
        // TO DO: right-side mismatch
        for (var l=0; l<rowsLeft.length; l++) {
            var pairFound = false;
            for (var r=0; r<rowsRight.length; r++) {                
                var match = joinPredicate(this.condition,
                                         rowsLeft[l][this.predicateLeftIndex],
                                         rowsRight[r][this.predicateRightIndex]);
                //console.log("OUTER Join exec - leftVal=" + rowsLeft[l][this.predicateLeftIndex] + " rightVal=" + rowsRight[r][this.predicateRightIndex] + " MATCH=" + match);

                if (match) {
                    pairFound = true;
                    //console.log("MATCHED " + rowsRight[r]);
                    var newRow = [];
                    for (var i=0; i<rowsLeft[l].length; i++) {
                        newRow.push(rowsLeft[l][i]);
                    }
                    for (var i=0; i<rowsRight[r].length; i++) {
                        newRow.push(rowsRight[r][i]);
                    }
                    rowsJoin.push(newRow);
                }
            }
            if (pairFound == false) {
                //console.log("NOT MATCHED " + rowsLeft[l]);
                var newRow = [];
                for (var i=0; i<rowsLeft[l].length; i++) {
                    newRow.push(rowsLeft[l][i]);
                }
                for (var i=0; i<rowsRight[0].length; i++) {
                    newRow.push(null);
                }
                rowsJoin.push(newRow);
            }
        }
        for (var r=0; r<rowsRight.length; r++) {
            var pairFound = false;
            for (var l=0; l<rowsLeft.length; l++) {
                var match = joinPredicate(this.condition,
                                          rowsLeft[l][this.predicateLeftIndex],
                                          rowsRight[r][this.predicateRightIndex]);
                if (match) {
                    pairFound = true;
                }
            }
            if (pairFound == false) {
                //console.log("NOT MATCHED " + rowsRight[r]);
                var newRow = [];
                for (var i=0; i<rowsLeft[0].length; i++) {
                    newRow.push(null);
                }
                for (var i=0; i<rowsRight[0].length; i++) {
                    newRow.push(rowsRight[r][i]);
                }
                rowsJoin.push(newRow);
            }
        }
    } else if (this.outerjointype == "LEFT") {
        for (var l=0; l<rowsLeft.length; l++) {
            var pairFound = false;
            for (var r=0; r<rowsRight.length; r++) {                
                var match = joinPredicate(this.condition,
                                         rowsLeft[l][this.predicateLeftIndex],
                                         rowsRight[r][this.predicateRightIndex]);
                //console.log("OUTER Join exec - leftVal=" + rowsLeft[l][this.predicateLeftIndex] + " rightVal=" + rowsRight[r][this.predicateRightIndex] + " MATCH=" + match);

                if (match) {
                    pairFound = true;
                    //console.log("MATCHED " + rowsRight[r]);
                    var newRow = [];
                    for (var i=0; i<rowsLeft[l].length; i++) {
                        newRow.push(rowsLeft[l][i]);
                    }
                    for (var i=0; i<rowsRight[r].length; i++) {
                        newRow.push(rowsRight[r][i]);
                    }
                    rowsJoin.push(newRow);
                }
            }
            if (pairFound == false) {
                //console.log("NOT MATCHED " + rowsLeft[l]);
                var newRow = [];
                for (var i=0; i<rowsLeft[l].length; i++) {
                    newRow.push(rowsLeft[l][i]);
                }
                for (var i=0; i<rowsRight[0].length; i++) {
                    newRow.push(null);
                }
                rowsJoin.push(newRow);
            }
        }
    } else if (this.outerjointype == "RIGHT") {
        for (var r=0; r<rowsRight.length; r++) {
            var pairFound = false;
            for (var l=0; l<rowsLeft.length; l++) {
                var match = joinPredicate(this.condition,
                                          rowsLeft[l][this.predicateLeftIndex],
                                          rowsRight[r][this.predicateRightIndex]);
                if (match) {
                    pairFound = true;
                    var newRow = [];
                    for (var i=0; i<rowsLeft[l].length; i++) {
                        newRow.push(rowsLeft[l][i]);
                    }
                    for (var i=0; i<rowsRight[r].length; i++) {
                        newRow.push(rowsRight[r][i]);
                    }
                    rowsJoin.push(newRow);
                }
            }
            if (pairFound == false) {
                //console.log("NOT MATCHED " + rowsRight[r]);
                var newRow = [];
                for (var i=0; i<rowsLeft[0].length; i++) {
                    newRow.push(null);
                }
                for (var i=0; i<rowsRight[0].length; i++) {
                    newRow.push(rowsRight[r][i]);
                }
                rowsJoin.push(newRow);
            }
        }
    } else {
        throw "Unknown join type " + this.outerjointype;
    }
    //console.log("====ROWS====\n" + ' ' + rowsJoin);
    return rowsJoin;
}

//-------------------------------------------------

/*** Supported joins
 *   INNER JOIN / JOIN
 *     Return rows when there is at least one match in both tables.
 *   NATURAL JOIN
 *     Return rows where column name(s) are the same.
 *   CROSS JOIN
 *     Cartesian product of the sets of rows from the joined tables. Each row
 *     from the first table is combined with each row from the second table.
 ***/
exports.Join = function() {
    this.conditionTree = null;
    this.colsOutput = [];
    this.requiredChildProperties = [];
    this.children = [];
    this.condition = null;
    this.predicateLeftIndex;
    this.predicateRightIndex;
}
exports.Join.prototype.addChild = function(op) {
    this.children.push(op);
}
exports.Join.prototype.getCost = function() {
    var cost = 5;
    for (var c=0; c<this.children.length; c++) {
        cost += this.children[c].getCost();
    }
    return cost;
}
exports.Join.prototype.getOperatorName= function() {
    return '[Join]';
}
exports.Join.prototype.printTree = function() {
    console.log(this.getOperatorName());
    if (SHOW_COLUMNS) {
        for (var i=0; i<this.colsOutput.length; i++) {
            console.log("  Col " + i + " OUT " + this.colsOutput[i]);
        }
        for (var i=0; i<this.requiredChildProperties.length; i++) {
            for (var j=0; j<this.requiredChildProperties[i].columns.length; j++) {
                console.log("  REQ Col[" + i + ',' + j + "] " + this.requiredChildProperties[i].columns[j]);
            }
        }
    }
    for (var c=0; c<this.children.length; c++) {
        this.children[c].printTree();
    }
}
exports.Join.prototype.exec = function() { 
    if (this.condition == null) {
        throw "join predicate not set";
    }
    var rowsLeft = this.children[0].exec();
    //console.log("====ROWS LEFT====\n" + ' ' + rowsLeft);
    var rowsRight = this.children[1].exec();
    //console.log("====ROWS RIGHT====\n" + ' ' + rowsRight);
    //console.log("Join exec - predicateLeftIndex=" + this.predicateLeftIndex);
    //console.log("Join exec - predicateRightIndex=" + this.predicateRightIndex);
    var rowsJoin = [];
    // TODO: use map()?
    for (var l=0; l<rowsLeft.length; l++) {
        for (var r=0; r<rowsRight.length; r++) {
            //console.log("====ROW LEFT====\n" + ' ' + rowsLeft[l]);
            //console.log("====ROW RIGHT====\n" + ' ' + rowsRight[r]);
            //console.log("Join exec - valLeft=" + rowsLeft[l][this.predicateLeftIndex]);
            //console.log("Join exec - valRight=" + rowsRight[r][this.predicateRightIndex]);
            if (!joinPredicate(this.condition,
                               rowsLeft[l][this.predicateLeftIndex],
                               rowsRight[r][this.predicateRightIndex])) {
                // move to next row
                continue;
            }
            var newRow = [];
            for (var i=0; i<rowsLeft[l].length; i++) {
                newRow.push(rowsLeft[l][i]);
            }
            for (var i=0; i<rowsRight[r].length; i++) {
                newRow.push(rowsRight[r][i]);
            }
            //console.log("====NEW ROW====\n" + ' ' + newRow);
            rowsJoin.push(newRow);
        }
    }
    //console.log("====ROWS====\n" + ' ' + rowsJoin);
    return rowsJoin;
}

function joinPredicate(op, valLeft, valRight) {
    //console.log("joinPredicate op=" + op + " valLeft=" + valLeft + " valRight=" + valRight);
    switch (op) {
    case '?':
	return true;
    case '=':
	// SQL sucks: comparison of NULLs
	if (valLeft == null) {
	    return false;
	} else if (valRight == null) {
	    return false;
	} else {
            return (valLeft == valRight);
	}
    case '!=':
        return (valLeft != valRight);
    default:
        throw "unknown join predicate operator '" + op + "'";
    }
}

//-------------------------------------------------

exports.Distinct = function() {
    this.colsOutput = [];
    this.requiredChildProperties = [];
    this.children = [];
}
exports.Distinct.prototype.addChild = function(op) {
    if (this.children.length > 0) {
        throw "DISTINCT node already has a child";
    }
    this.children.push(op);
}
exports.Distinct.prototype.getCost = function() {
    var cost = 3;
    for (var c=0; c<this.children.length; c++) {
        cost += this.children[c].getCost();
    }
    return cost;
}
exports.Distinct.prototype.getOperatorName= function() {
    return '[Distinct]';
}
exports.Distinct.prototype.printTree = function() {
    console.log(this.getOperatorName());
    if (SHOW_COLUMNS) {
        for (var i=0; i<this.colsOutput.length; i++) {
            console.log("  Col " + i + " OUT " + this.colsOutput[i]);
        }
        for (var j=0; j<this.requiredChildProperties[0].columns.length; j++) {
            console.log("  REQ Col " + this.requiredChildProperties[0].columns[j]);
        }
    }
    for (var c=0; c<this.children.length; c++) {
        this.children[c].printTree();
    }
}
exports.Distinct.prototype.exec = function() { 
    //console.log("DISTINCT: exec");
    var rows = this.children[0].exec();

    // NOTE: distinct by column type (lexicographical/numeric/datetime/etc.)
    // find distinct rows
    var arr = rows.sort();
    var rowsDistinct = [arr[0]];
    for (var i=1; i<arr.length; i++) {
        var rowMatch = true;
        for (var j=0; j<rows[0].length; j++) {
            if (arr[i-1][j] != arr[i][j]) {
                rowMatch = false;
                break;
            }
        }
        if (!rowMatch) {
            rowsDistinct.push(arr[i]);
        }
    }
    return rowsDistinct;
}

//-------------------------------------------------

function group() {
    this.value = null;
    this.rows = [];
}

exports.Grouping = function() {
    this.colsOutput = [];
    this.requiredChildProperties = [];
    this.children = [];
    this.aggregateFunction = null;
    this.groupIndex = -1;
    this.aggregateIndex = -1;
}
exports.Grouping.prototype.addChild = function(op) {
    if (this.children.length > 0) {
        throw "GROUPING node already has a child";
    }
    this.children.push(op);
}
exports.Grouping.prototype.getCost = function() {
    var cost = 3;
    for (var c=0; c<this.children.length; c++) {
        cost += this.children[c].getCost();
    }
    return cost;
}
exports.Grouping.prototype.getOperatorName= function() {
    return '[Grouping]';
}
exports.Grouping.prototype.printTree = function() {
    console.log(this.getOperatorName());
    if (SHOW_COLUMNS) {
        for (var i=0; i<this.colsOutput.length; i++) {
            console.log("  Col " + i + " OUT " + this.colsOutput[i]);
        }
        for (var j=0; j<this.requiredChildProperties[0].columns.length; j++) {
            console.log("  REQ Col " + this.requiredChildProperties[0].columns[j]);
        }
    }
    for (var c=0; c<this.children.length; c++) {
        this.children[c].printTree();
    }
}
exports.Grouping.prototype.exec = function() { 
    //console.log("GROUPING: exec");
    var rows = this.children[0].exec();

    var rowsGrouping = [];
    var g = new group();
    g.value = rows[0][this.groupIndex];
    g.rows.push(rows[0]);
    rowsGrouping.push(g);
    for (var i=1; i<rows.length; i++) {
	var groupMatch = false;
        for (var j=0; j<rowsGrouping.length; j++) {
	    //console.log("GROUPING val = " + rowsGrouping[j].value + " row val = " + rows[i][this.groupIndex]);
	    if (rowsGrouping[j].value == rows[i][this.groupIndex]) {
		groupMatch = true;
		rowsGrouping[j].rows.push(rows[i]);
	    }
	}
	if (groupMatch == false) {
	    var g = new group();
	    g.value = rows[i][this.groupIndex];
	    g.rows.push(rows[i]);
	    rowsGrouping.push(g);
	}
    }

    var rowsResult = [];
    for (var j=0; j<rowsGrouping.length; j++) {
	var r = [];
	r.push(rowsGrouping[j].value);
	var aggValue = aggFunction(this.aggregateFunction, rowsGrouping[j].rows, this.aggregateIndex);
	r.push(aggValue);
	rowsResult.push(r);
    }
    return rowsResult;
}

//-------------------------------------------------

exports.Sort = function() {
    this.colsOutput = [];
    this.requiredChildProperties = [];
    this.children = [];
    this.sortColumn = null;
    this.sortDirection = null;
}
exports.Sort.prototype.addChild = function(op) {
    if (this.children.length > 0) {
        throw "SORT node already has a child";
    }
    this.children.push(op);
}
exports.Sort.prototype.getCost = function() {
    var cost = 3;
    for (var c=0; c<this.children.length; c++) {
        cost += this.children[c].getCost();
    }
    return cost;
}
exports.Sort.prototype.getOperatorName= function() {
    return '[Sort]';
}
exports.Sort.prototype.printTree = function() {
    console.log(this.getOperatorName());
    if (SHOW_COLUMNS) {
        for (var i=0; i<this.colsOutput.length; i++) {
            console.log("  Col " + i + " OUT " + this.colsOutput[i]);
        }
        for (var j=0; j<this.requiredChildProperties[0].columns.length; j++) {
            console.log("  REQ Col " + this.requiredChildProperties[0].columns[j]);
        }
    }
    for (var c=0; c<this.children.length; c++) {
        this.children[c].printTree();
    }
}
exports.Sort.prototype.exec = function() { 
    console.log("SORT: sort column '" + this.sortColumn + "' direction = " + this.sortDirection);
    var rows = this.children[0].exec();

    // NOTE: sort by column type (lexicographical/numeric/datetime/etc.)
    return rows.sort(sortfunction(this.sortColumn, this.sortDirection));
}

function sortfunction(idx, direction) {
    // Compare and return -1, 0, or 1
    var reverse = 1;
    if (direction == "DESC") {
        reverse = -1;
    }

   return function (a, b) {
       var a = a[idx];
       var b = b[idx];
       return reverse * ((a > b) - (b > a));
     } 
}

//-------------------------------------------------

// AGGREGATE operator handles grouping and aggregate functions
exports.Aggregate = function() {
    this.colsOutput = [];
    this.aggregateIndex = -1;
    this.aggregateFunction = null;
    this.requiredChildProperties = [];
    this.children = [];
    this.grouping = null;
    this.having = null;
}
exports.Aggregate.prototype.addChild = function(op) {
    if (this.children.length > 0) {
        throw "Aggregate node already has a child";
    }
    this.children.push(op);
}
exports.Aggregate.prototype.getCost = function() {
    var cost = 3;
    if (this.children > 0) {
        cost += this.children[0].getCost();
    }
    return cost;
}
exports.Aggregate.prototype.getOperatorName= function() {
    return '[Aggregate]';
}
exports.Aggregate.prototype.printTree = function() {
    console.log(this.getOperatorName());
    if (SHOW_COLUMNS) {
        for (var i=0; i<this.colsOutput.length; i++) {
            console.log("  Col OUT " + this.colsOutput[i]);
        }
        for (var i=0; i<this.requiredChildProperties[0].columns.length; i++) {
            console.log("  REQ Col " + this.requiredChildProperties[0].columns[i]);
        }
    }
    if (this.children.length > 0) {
        this.children[0].printTree();
    }
}
exports.Aggregate.prototype.exec = function() { 
    //console.log("AGGREGATE EXEC len=" + this.colsOutput.length);
    //console.log("==== AGG aggregate index= " + this.aggregateIndex + " func=" + this.aggregateFunction);
    var rows = this.children[0].exec();
    //console.log("==== AGG ROWS IN ====\n" + ' ' + rows);

    if (rows.length == 0) {
        // array of array of 0
        return [[0]];
    }

    if (this.aggregateFunction == null) {
        throw "No aggregate function was specified"
    }

    switch (this.aggregateFunction) {
    case "COUNT":
        //console.log("Aggregate: COUNT function");
	// handle special case of COUNT(*)
	if (this.grouping == null) {
            return [[rows.length]];
	}
        break;
    case "MAX":
        //console.log("Aggregate: MAX function");
        break;
    case "MIN":
        //console.log("Aggregate: MIN function");
        break;
    case "AVG":
        //console.log("Aggregate: AVG function");
        break;
    case "SUM":
        //console.log("Aggregate: SUM function");
        break;
    default:
        console.log("Aggregate: general function");
    }

    if (this.grouping == null) {
	var answer = [];
        var row = [];
        var aggValue = aggFunction(this.aggregateFunction, rows, this.aggregateIndex);
        //console.log("AGG value " + aggValue);
        row.push(aggValue);
        answer.push(row);
	return answer;
    }

    // build group(s) for aggregate functions
    var colnum = -1;
    for (var g=0; g<this.grouping.length; g++) {
        //console.log("==== AGG grouping: col=" + this.grouping[g]);
        for (var c=0; c<this.requiredChildProperties[0].columns.length; c++) {
            if (this.grouping[g] == this.requiredChildProperties[0].columns[c]) {
                //console.log("==== AGG grouping: col=" + this.grouping[g] + " colnum = " + c);
                colnum = c;
                break;
            }
        }
    }
    if (colnum == -1) {
        throw "No aggregate columns found";
    }

    // SQL aggregate functions depend on GROUPing
    var groups = [];
    for (var r=0; r<rows.length; r++) {
        //console.log("==== AGG grouping: VAL=" + rows[r][colnum]);
        var rowAdded = false;
        for (var g=0; g<groups.length; g++) {
            if (groups[g].val == rows[r][colnum]) {
                groups[g].rows.push(rows[r]);
                rowAdded = true;
                break;
            }
        }
        if (rowAdded == false) {
            var newGroup = { 'val' : rows[r][colnum], 'rows' : [] };
            newGroup.rows.push(rows[r]);
            groups.push(newGroup);
        }
    }

    var answer = [];
    for (var g=0; g<groups.length; g++) {
        var row = [];
        //console.log("AGGREGATE EXEC col=" + this.colsOutput[j]);
        row.push(groups[g].val);
        var aggValue = aggFunction(this.aggregateFunction, groups[g].rows, this.aggregateIndex);
        //console.log("AGG value " + aggValue);
        row.push(aggValue);
        answer.push(row);
    }
    return answer;
}

function GroupRow(key) {
    this.key = key;
    this.rows = [];
}

function aggFunction(func, rows, idx) {
    //console.log("AGG func=" + func + " idx=" + idx);
    switch (func) {
    case "COUNT":
        //console.log("COUNT function");
        return rows.length;
    case "MAX":
        //console.log("MAX function");
        if (!rows || rows.length < 1) {
            throw "no rows passed to MAX aggregate function";
        }
        var max = rows[0][idx];
        for (var i=0; i<rows.length; i++) {
            if (rows[i][idx] > max) {
                max = rows[i][idx];
            }
        }
        return max;
    case "MIN":
        //console.log("MIN function");
        if (!rows || rows.length < 1) {
            throw "no rows passed to MIN aggregate function";
        }
        var min = rows[0][idx];
        for (var i=0; i<rows.length; i++) {
            if (rows[i][idx] < min) {
                min = rows[i][idx];
            }
        }
        //console.log("AGG MIN func " + min);
        return min;
    case "AVG":
        //console.log("AVG function");
        if (!rows || rows.length < 1) {
            throw "no rows passed to AVG aggregate function";
        }
        var sum = 0;
        for (var i=0; i<rows.length; i++) {
            sum += rows[i][idx];
        }
        return sum / rows.length;
    case "SUM":
        //console.log("SUM function");
        if (!rows || rows.length < 1) {
            throw "no rows passed to SUM aggregate function";
        }
        var sum = 0;
        for (var i=0; i<rows.length; i++) {
            //console.log("SUM row=" + rows[i]);
            sum += rows[i][idx];
        }
        return sum;
    default:
        console.log("non-standard AGG function '" + func + "'");
        return func + "?";
    }
}
