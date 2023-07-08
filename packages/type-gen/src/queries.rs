use crate::types::*;
use fallible_iterator::FallibleIterator;
use sqlite3_parser::{
    ast::{Cmd, Stmt},
    lexer::sql::{Error, Parser},
};
use std::collections::HashMap;

struct Selected {
    pub qualifier: Option<String>,
    pub name: String,
    pub alias: Option<String>,
    pub t_type: Option<String>,
    pub c_num: u32,
}

pub fn get_result_shapes(
    query: String,
    schema: HashMap<RelationName, Vec<Col>>,
) -> Result<Relation, Error> {
    /*
    Parse the query.
    Build selection set info.
    [qualifier, name, alias]

    Build Relation aliases against which selection set resolves types by use of qualifier.
    Sub-select just return relations.
    Aggregate functions... understand the type produced by the agg. concat vs sum vs ...

    Then resolve selection set types
    */
    let mut parser = Parser::new(query.as_bytes());
    let mut ret = vec![];

    while let Some(cmd) = parser.next()? {
        match cmd {
            Cmd::Stmt(stmt) => {
                if let Some(query_result_shape) = maybe_query(stmt) {
                    ret.push(query_result_shape)
                }
            }
            _ => {}
        }
    }

    Ok(("rec".to_string(), vec![]))
}

fn maybe_query(_stmt: Stmt) -> Option<Relation> {
    None
}
