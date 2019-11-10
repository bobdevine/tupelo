# Tupelo Database

Tupelo (yes, the name was selected for the obvious word-play) is a simple database written in about 3,000 lines of Javascript. A Tupelo back-end runs inside nodeJS and the front-end can be used from a browser. Minimal dependencies are needed to run Tupelo.

Tupelo can be used as a teaching tool because the code is fairly readable and organized in only a few files.

##  Tupelo Architecture
Tupelo follows the industry-standard pattern for its system architecture. First a database query is parsed into a syntax tree then that query tree is converted into a logically-equivalent tree of operators, which is the converted into an executeable plan tree. An optimization stage attempts to improve the logical tree or plan tree. Finally, an execution stage runs the plan tree and passes the result back to the client.

A key concept in Tupelo is a “contract” between nodes in the operator tree. Each node lists the properties it needs. The contracts between nodes is examined by the optimizer so that only legal transformations can be made.

##  Tupelo Language Support
Tupelo implements most of SQL. Missing are subqueries and vendor-specific extensions.
The PegJS lexer/parser library enforces the SQL grammar. When the Tupelo server starts, the server reads the latest grammar file and creates the run-time lexical system.

NOTE: The current error messages can be hard to understand; a hand-written parser could improve the error handling by better understanding the context of an error.

##  Tupelo Optimizer
In Sql a query can be executed in many different ways. The goal of the optimizer is to find a good way to quickly produce the expected answer while minimizing computer resources. There are two broad methods for optimizing a query, First, a query can be logically rewritten to a simpler plan that is semantically equivalent. Second, the query can be transformed into a more efficient implementation.

The Tupelo optimizer uses a rule engine to modify the query. Estimates of execution costs control the optimization process. 
