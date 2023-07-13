use fallible_iterator::FallibleIterator;
use sqlite3_parser::{
    ast::{Cmd, ColumnDefinition, CreateTableBody, Stmt},
    lexer::sql::{Error, Parser},
};

use crate::types::*;

pub fn get_relation_shapes(ddl: String) -> Result<Vec<NamedRelation>, Error> {
    let mut parser = Parser::new(ddl.as_bytes());
    let mut ret = vec![];

    while let Some(cmd) = parser.next()? {
        match cmd {
            Cmd::Stmt(stmt) => {
                if let Some(record) = maybe_record(stmt) {
                    ret.push(record)
                }
            }
            _ => {}
        }
    }

    Ok(ret)
}

fn maybe_record(stmt: Stmt) -> Option<NamedRelation> {
    match stmt {
        Stmt::CreateTable { tbl_name, body, .. } => Some((tbl_name.name.0, get_properties(body))),
        _ => None,
    }
}

fn get_properties(body: CreateTableBody) -> Vec<Col> {
    // TODO: AsSelect would depend on things already defined.
    // We should allow access to that then so we can support AsSelect.
    // The data format should then match what JS provides us when asking for types on queries.
    match body {
        CreateTableBody::AsSelect(_) => {
            vec![]
        }
        CreateTableBody::ColumnsAndConstraints { columns, .. } => columns
            .into_iter()
            .map(|c| column_as_property(c))
            .collect::<Vec<Col>>(),
    }
}

// Faithfully return types as specified. The layer above us (TS or Java or ...) will map to their native types.
fn column_as_property(column: ColumnDefinition) -> Col {
    (
        column.col_name.0,
        if let Some(col_type) = column.col_type {
            type_from_type_name(col_type.name)
        } else {
            builtin_type(BuiltinType::Unspecified)
        },
    )
}
