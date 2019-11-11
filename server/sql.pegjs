{
  function listToString(x, xs) {
      return [x].concat(xs).join("");
  }

  function listToArray(e, ex) {
    var arr = [];
    arr.push(e);
    for (var i=0; i<ex.length; i++) {
        arr.push(ex[i]);
    }
    return arr;
  }
}


Start
  = s:Statement sx:StatementList*
  {
   return listToArray(s, sx)
  }

Statement
  = select_stmt
  / create_table_stmt
  / show_tables_stmt
  / show_table_stmt
  / drop_table_stmt
  / insert_stmt
  / blank_stmt

StatementList
  = _ ';' _ s:Statement
  {
    return s;
  }

blank_stmt
  = _
  {
    return { stmt: "BLANK" };
  }

select_stmt
  = _ "SELECT"i _ d:( "DISTINCT"i / "ALL"i ) ?
    _ c:SelectField cx:SelectFieldList*
    _ "FROM"i _ t:SelectTable  tx:SelectTableList*
    _ w:WhereExpr?
    _ gb:GroupByExpr?
    _ h:HavingExpr?
    _ ob:OrderByExpr?
    {
      var dup = null;
      if (d) {
        dup = d.toUpperCase();
      }
      return {
	stmt: "SELECT",
	duplicates: dup,
	fields: listToArray(c, cx),
	from: listToArray(t, tx),
	where: w,
	groupby: gb,
	having: h,
	orderby: ob
      };
    }
	
SelectField
  = "COUNT"i _ LPAREN _ "*" _ RPAREN  a:( SelectFieldAlias ) ?
    {
      return { func: "COUNT", param: "*", alias: a };
    }
  / f:("AVG"i / "MAX"i / "MIN"i / "SUM"i / "COUNT"i)
  _ LPAREN _ p:Identifier _ RPAREN a:( SelectFieldAlias ) ?
    {
      return { func: f.toUpperCase(), param: p, alias: a };
    }
  / f:Identifier _ LPAREN _ p:LITERAL _ RPAREN  a:( SelectFieldAlias ) ?
    {
      return { func: f, param: p, alias: a };
    }
  / f:Identifier a:( SelectFieldAlias ) ?
    {
      return { field: f, alias: a };
    }
  / '*'
    {
      return { field: "*" };
    }

SelectFieldList
  = _ ',' _ s:SelectField
  {
    return s;
  }

SelectFieldAlias
  = _ "AS"i _ a:Identifier
  {
    return a;
  }

SelectTable
  = t:Identifier _ ta:( SelectTableAlias ) ? _ "CROSS JOIN"i _ cj:Identifier _ cja:( SelectTableAlias ) ?
  {
    return { table: t, alias:ta, crossjointable: cj, alias2:cja };
  }
  / t:Identifier _ ta:( SelectTableAlias ) ? _ "NATURAL JOIN"i _ nj:Identifier _ nja:( SelectTableAlias ) ?
  {
    return { table: t, alias:ta, naturaljointable: nj, alias2:nja };
  }
  / t:Identifier _ ta:( SelectTableAlias ) ? _ ("INNER"i _)?  "JOIN"i _ ij:Identifier _ ija:( SelectTableAlias ) ? _ "ON"i _ c:JoinOnCondition
  {
    return { table: t, alias:ta, innerjointable: ij, alias2:ija, cond:c };
  }
  / t:Identifier _ ta:( SelectTableAlias ) ? _ oj:("LEFT"i / "RIGHT"i / "FULL"i) _ ("OUTER"i)? _ "JOIN"i _ ojt:Identifier _ oja:( SelectTableAlias ) ? _ "ON"i _ c:JoinOnCondition
  {
    return { table: t, alias:ta, outerjointype:oj.toUpperCase(), outerjointable: ojt, alias2:oja, cond: c };
  }
  / t:Identifier _ ta:( SelectTableAlias ) ? _ "NATURAL JOIN"i _ nj:Identifier nja:( SelectTableAlias ) ?
  {
    return { table: t, alias:ta, naturaljointable:nj, alias2:nja };
  }
  / t:Identifier _ ta:( SelectTableAlias ) ? _ "UNION"i _ a:("ALL"i)? _ u:Identifier ua:( SelectTableAlias ) ?
  {
    var unionall = null;
    if (a) {
      unionall = a.toUpperCase();
    }
    return { table: t, alias:ta, all:unionall, uniontable: u,  alias2:ua };
  }
  / t: Identifier _ a:( SelectTableAlias ) ?
  {
    return { table: t, alias: a };
  }
  
SelectTableAlias
  = !("WHERE"i / "LEFT"i / "RIGHT"i / "FULL"i / "UNION"i / "INNER"i / "NATURAL"i / "CROSS"i / "ON"i / "ORDER"i) ("AS"i)? _ a:Identifier
  {
    return a;
  }
  
SelectTableList
  = _ ',' _ t:SelectTable
  {
    return t;
  }

JoinOnCondition
  = l:OnIdentifier _ op:('='/'>='/'>'/'!='/'<'/'<=>'/'<='/'<>') _ r:OnIdentifier
    {
      return {
        left: l,
        operator: op,
        right: r
      };
    }

OnIdentifier
  = Identifier "." Identifier
  / Identifier


WhereExpr
  = "WHERE"i _ c:SearchCondition
  {
    return c;
  }

GroupByExpr
  = "GROUP"i _ "BY"i gb:GroupByParam gbx:GroupByParamList*
  {
    return listToArray(gb, gbx);
  }

GroupByParam
  =  _ id:Identifier _ d:("ASC"i / "DESC"i)?
  {
    var dir;
    if (d) {
      dir = d.toUpperCase();
    } else {
      dir = "ASC";
    }
    return {
      ident : id,
      direction: dir
    };
  }

GroupByParamList
  = _ ',' _ g:GroupByParam
  {
    return g;
  }

HavingExpr
  = "HAVING"i _ h:SearchCondition

OrderByExpr
  = "ORDER"i _ "BY"i _ ob:Identifier _ d:("ASC"i / "DESC"i)?
    {
      var dir;
      if (d) {
	dir = d.toUpperCase();
      } else {
	dir = "ASC";
      }
      return { arg: ob, direction: dir };
    }


SearchCondition
  = l:BooleanTerm _ "OR"i _ r:SearchCondition
    {
      return {
        operator: "OR",
        left: l,
        right: r
      };
    }
  / BooleanTerm

BooleanTerm
  = l:EXPR _ "AND"i _ r:BooleanTerm
    {
      return {
        operator: "AND",
        left: l,
        right: r
      };
    }
  / EXPR


EXPR
  = l:ADD_EXPR _ "IS"i _ n:"NOT"i? _ "NULL"i
    { var op = "ISNULL";
      if (n) {op = "ISNOTNULL";}
      return { left:l, operator: op};
    }
  / l:ADD_EXPR _ n:"NOT"i? _ 'LIKE'i  _ r:String
    { var op = "LIKE";
      if (n) { op = "NOTLIKE"; }
      return { left:l, operator: op, right: r};
    }
  / l:ADD_EXPR _ "NOT"i? _ 'IN'i  _ r:ADD_EXPR
    { var op = "IN";
      if (n) { op = "NOTIN"; }
      return { left:l, operator: op, right: r};
    }
  / l:ADD_EXPR _ n:"NOT"i? _ 'BETWEEN'i  _ lo:ADD_EXPR _ "AND"i  _ hi:ADD_EXPR
    { var op = "BETWEEN";
      if (n) { op = "NOTBETWEEN"; }
      return { left:l, operator: op, rangeLow:lo, rangeHigh:hi};
    }
  / l:ADD_EXPR _ op:('='/'<=>'/'>='/'>'/'<='/'<>'/'<'/'!=') _ r:ADD_EXPR
    {
      return {
        left: l,
        operator: op,
        right: r
      };
    }

ADD_EXPR
  = l:MULT_EXPR _ op:('+'/'-') _ r:MULT_EXPR
  {
      return {
        operator: op,
        left: l,
        right: r
      };
    }
  / MULT_EXPR

MULT_EXPR
  = l:PRIMARY_EXPR _ op:('*' / '/' / 'DIV'i / '%' / '^' / 'MOD'i) _ r:PRIMARY_EXPR
    {
      return {
        operator: op,
        left: l,
        right: r
      };
    }
  / PRIMARY_EXPR


PRIMARY_EXPR
  = LPAREN expr:ADD_EXPR RPAREN
    { return expr; }
  / Identifier "." Identifier
  / Identifier
  / LITERAL

LITERAL
  = "NULL"i
  / Boolean
  / Float
  / Integer
  / String
  / Identifier

Boolean "Boolean"
  = "TRUE"i
  / "FALSE"i

Integer "integer"
  = s:[\+\-]? n:[0-9]+
  {
    if (s && s == '-') {
      return parseInt('-' + n.join(""));
    } else {
      return parseInt(n.join(""));
    }
  }

UnsignedInteger "unsigned integer"
  = n:[0-9]+
  {
    return parseInt(n.join(""));
  }

Float "float"
  = left:Integer "." right:UnsignedInteger
  {
    return parseFloat([
      left.toString(),
      right.toString()
    ].join("."));
  }

String "string"
  = "'" str:ValidStringChar* "'"
  {
    return "'" + str.join("") + "'";
  }

ValidStringChar
  = !"'" c:.
  {
    return c;
  }


/*---------------------------------------------*/

create_table_stmt
  = _ "CREATE"i _ "TABLE"i
    _ t:Identifier
    _ LPAREN _ c:tbl_col_def cs:(tbl_col_def_multiple)* _ RPAREN
    {
      return {
	stmt: "CREATE_TABLE",
	tablename: t,
	tcols: [c].concat(cs)
      };
  }

tbl_col_def
  = i:Identifier _ t:tbl_col_type_name _ c:tbl_col_constraint?
  {
    return {
      colname: i,
      coltype: t,
      constraint: c
    };
  }

tbl_col_def_multiple
  = _ ',' _ s:tbl_col_def
  {
    return s;
  }

tbl_col_type_name
  = "INT"i ("EGER"i)? _ s:tbl_col_type_size?
    {  return {typename:"INTEGER", typesize:s||'='};  }
  / "DECIMAL"i _ s:tbl_col_type_size
    {  return {typename:"DECIMAL", typesize:s};  }
  / "FLOAT"i
    {  return {typename:"FLOAT", typesize:'='};  }
  / "DOUBLE"i  _ s:tbl_col_double_size
    {  return {typename:"DOUBLE", typesize: s};  }
  / "CHAR"i _ s:tbl_col_type_size
    {  return {typename:"CHAR", typesize:s||'1'};  }
  / "VARCHAR"i _ s:tbl_col_type_size
    {  return {typename:"VARCHAR", typesize:s||'='};  }
  / "VAR"i ("YING"i)? _ "CHAR"i ("ACTER"i)? _ s:tbl_col_type_size
    {  return {typename:"VARCHAR", typesize:s||'='};  }
  / "DATETIME"i
    {  return {typename:"DATETIME", typesize:'='};  }
  / "DATE"i
    {  return {typename:"DATE", typesize:'='};  }
  / "TIME"i
    {  return {typename:"TIME", typesize:'='};  }

tbl_col_type_size
  = LPAREN _ n:[0-9]+ _ RPAREN
    {
      return parseInt(n.join(""));
    }

tbl_col_double_size
  = _ LPAREN _ n:[0-9]+ _ ',' _ d:[0-9]+ _ RPAREN
    {
      return {
        'num' : parseInt(n.join("")),
        'dec' : parseInt(d.join(""))
	};
    }

tbl_col_constraint
  = "PRIMARY"i _ "KEY"i k:( _ "ASC"i / "DESC"i )?
    { var direction = "ASC";
      if (k) { direction = k.toUpperCase(); }
      return {
        "PRIMARYKEY": direction
	 };
    }
  / "NOT"i _ "NULL"i
    { return "NOTNULL"; }
  / "UNIQUE"i
    { return "UNIQUE"; }


/*---------------------------------------------*/

drop_table_stmt
  = _ "DROP"i _ "TABLE"i _ t:Identifier
    {
      return {
	stmt: "DROP_TABLE",
	tablename: t
      };
    }

/*---------------------------------------------*/

show_tables_stmt
  = _ "SHOW"i _ "TABLES"i
    {
      return {
	stmt: "SHOW_TABLES",
      };
    }

/*---------------------------------------------*/

show_table_stmt
  = _ "SHOW"i _ "TABLE"i _ t:Identifier
    {
      return {
	stmt: "SHOW_TABLE",
	tablename: t
      };
    }

/*---------------------------------------------*/
insert_stmt
  = "INSERT"i _ "INTO"i _ t:Identifier _
    LPAREN _ c:colInsert cx:colInsertList* _ RPAREN
    _ "VALUES"i _ vg:valInsertGroup _ vgx:valInsertGroupList*
    {
      return {
	stmt: "INSERT",
	tablename: t,
	columns: listToArray(c, cx),
	values: listToArray(vg, vgx)
      };
    }

colInsert
  = Identifier

colInsertList
  = _ ',' _ c:colInsert
  {
    return c;
  }
    
valInsertItem
  = _ ',' _ v:LITERAL
  {
    return v;
  }

valInsertGroup
  = LPAREN _ v:LITERAL _ vx:valInsertItem* _ RPAREN
  {
    return listToArray(v, vx)
  }

valInsertGroupList
  = _ ',' _ vig:valInsertGroup
  {
    return vig
  }
  
/*---------------------------------------------*/

LPAREN = '('
RPAREN = ')'
COMMENT_BEG = '/*'
COMMENT_END = '*/'


Identifier "identifier"
  = x:IdentStart xs:IdentRest*
  {
    return listToString(x, xs);
  }

IdentStart = [a-z_]i
IdentRest = [a-z0-9_\.]i

_  = ( WhiteSpace )*

WhiteSpace "WHITESPACE"
  = " "
  / "\t"
  / "\v"
  / "\f"
