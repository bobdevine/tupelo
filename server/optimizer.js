const Operators = require("./operators");

// this cost-based optimizer chooses the best execution plan
// based on estimates about resource costs and performance
//
// NOTE: the optimizer could be structued as a multi-path graph
// (or banyon tree or forest or ...) to represent alternative
// solutions, but this code uses simple trees.
//
// NOTE: the optimizer works on the whole tree. Additional
// optimizations would be possible with a sub-tree focus.
//
// NOTE: the optimizer could use more properties (eg sort order).
//
// NOTE: 

exports.optimize = function(tree) {
    //console.log("Optimize ++++++++++++++ START " + tree.getOperatorName());
    // start with child of DISPLAY op
    improveTree(tree, RULES_LOGICAL);
    //tree.printTree();
    
    // keep modifying tree until no more cost reductions
    while (true) {
        var costCurrent = tree.getCost();
        console.log("Optimize ---------------- current cost:" + costCurrent);
        improveTree(tree, RULES_COST);
        var costNew = tree.getCost();
        if (costNew >= costCurrent) {
            console.log("Optimize ================ final cost:" + costNew);
            break;
        }
    }

    return tree;
}


function improveTree(tree, ruleset) {
    console.log(tree.getOperatorName());
    runRules(tree, ruleset);
    for (var c=0; c<tree.children.length; c++) {
        improveTree(tree.children[c], ruleset);        
    }
}


function runRules(node, rules) {
    for (var i=0; i<rules.length; i++) {
        rules[i](node);
    }
}

//---------------------------------------------------------

const RULES_LOGICAL = [
    //ruleColumnAddAll,
    ruleColumnCount,
    ruleColumnOrder,
];

const RULES_COST = [
    ruleSelect1,
    ruleCartesianProduct1,
    //ruleColumnCount,
];

//-----------------------------------------------------

function ruleColumnAddAll(node) {
    //console.log("ruleColumnAddAll");
    // check if all columns are included
    for (var i=0; i<node.colsNeeded.length; i++) {
        var colname = node.colsNeeded[i];
        //console.log("Node col needed :" + colname);
        //console.log("Child col output :");
        var colFound = false;
        for (var j=0; j<child.colsOutput.length; j++) {
            //console.log("ruleColumnAddAll -- " + child.colsOutput[j]);
            if (colname == child.colsOutput[j]) {
                colFound = true;
                break;
            }
        }
        if (colFound == false) {
            child.colsOutput.push(colname);
        }
    }
}

function ruleColumnOrder(node) {
    //console.log("ruleColumnOrder");
    // change order of columns by inserting a PROJECT node
    for (var c=0; c<node.children.length; c++) {
        //console.log("ruleColumnOrder: node = " + node.getOperatorName() + " child = " + node.children[c].getOperatorName());
        //var parentCols = node.colsNeeded;
        var parentCols = node.requiredChildProperties[c].columns;
        var childCols = node.children[c].colsOutput;    
        var lenColsNeeded = parentCols.length;
        var lenColsSupplied = childCols.length;
        if (lenColsNeeded != lenColsSupplied) {
            // this rule needs equal #s to work
            return;
        }

        var remapNeeded = false;
        for (var i=0; i<lenColsNeeded; i++) {
            if (parentCols[i] != childCols[i]) {
                remapNeeded = true;
                break;
            }
        }
        
        if (remapNeeded) {
            var opProject = new Operators.Project();
            opProject.children.push(node.children[c]);
            opProject.filter = [];
            opProject.requiredChildProperties.push(new Operators.Properties());
            for (var j=0; j<childCols.length; j++) {
                opProject.requiredChildProperties[0].columns.push(childCols[j]);
            }
            for (var i=0; i<parentCols.length; i++) {
                var colname = parentCols[i];
                opProject.colsOutput.push(colname);
                for (var j=0; j<childCols.length; j++) {
                    if (colname == childCols[j]) {
                        opProject.filter.push(j);
                    }
                }
            }
            node.children[c] = opProject;
            //console.log("ruleColumnOrder filter=" + opProject.filter);
        }
    }
}

function ruleColumnCount(node) {
    //console.log("ruleColumnCount");
    // adjust number of columns by inserting a PROJECT node
    for (var c=0; c<node.children.length; c++) {
        console.log("ruleColumnCount: node = " + node.getOperatorName() + " child = " + node.children[c].getOperatorName());
        var parentCols = node.requiredChildProperties[c].columns;
        var childCols = node.children[c].colsOutput;    
        if (columnMismatch(parentCols, childCols)) {
            console.log("column mismatch found - with child " + c);
            var opProject = new Operators.Project();
            opProject.children.push(node.children[c]);
            opProject.filter = [];
            opProject.requiredChildProperties.push(new Operators.Properties());
            for (var j=0; j<childCols.length; j++) {
                opProject.requiredChildProperties[0].columns.push(childCols[j]);
            }
            for (var i=0; i<parentCols.length; i++) {
                var colname = parentCols[i];
                opProject.colsOutput.push(colname);
                for (var j=0; j<childCols.length; j++) {
                    if (colname == childCols[j]) {
                        opProject.filter.push(j);
                    }
                }
            }
            node.children[c] = opProject;
            console.log("ruleColumnCount filter=" + opProject.filter);
        }
    }
}

function columnMismatch(parentCols, childCols) {
    var setColsNeeded = uniqueArray(parentCols);
    var setColsSupplied = uniqueArray(childCols);
    var lenColsNeeded = parentCols.length;
    var lenColsSupplied = childCols.length;
    if (setColsNeeded.length < setColsSupplied.length) {
        //         || (lenColsNeeded < lenColsSupplied) ) {
        console.log("columnMismatch: lenColsNeeded=" + lenColsNeeded + " lenColsSupplied=" + lenColsSupplied);
        for (var i=0; i<lenColsNeeded; i++) {
            console.log("  Cols needed (parent) = " + parentCols[i]);
        }
        for (var i=0; i<lenColsSupplied; i++) {
            console.log("  Cols supplied (child) = " + childCols[i]);
        }
        return true;
    }
    return false;
}

function uniqueArray(arr) {
    var a = [];
    for (var i=0, l=arr.length; i<l; i++)
        if (a.indexOf(arr[i]) === -1)
            a.push(arr[i]);
    return a;
}

// eliminate SELECT if it is not needed
function ruleSelect1(node) {
    //console.log("ruleSelect1");
    for (var c=0; c<node.children.length; c++) {
        var child = node.children[c];
        if (child instanceof Operators.Select) {
            if (child.evalTree == null) {
                node.children[0] = child.children[0];
            }
        }
    }
}

// eliminate CP if it has only one child
function ruleCartesianProduct1(node) {
    //console.log("ruleCartesianProduct1");
    for (var c=0; c<node.children.length; c++) {
        var child = node.children[c];
        if (child instanceof Operators.CartesianProduct) {
            //console.log("child is CartesianProduct");
            if (child.children.length == 1) {
                node.children[0] = child.children[0];
            }
        }
    }
}

function ruleJoin1(node) {
    console.log("ruleJoin1 node type = " + node.getOperatorName());
}
