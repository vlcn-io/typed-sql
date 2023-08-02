use crate::error::Error;
use fallible_iterator::FallibleIterator;
use sqlite3_parser::{
    ast::{Cmd, ColumnConstraint, ColumnDefinition, CreateTableBody, Stmt},
    lexer::sql::Parser,
};

use crate::types::*;
use crate::util;

pub fn get_relation_shapes(ddl: String) -> Result<Vec<NamedRelation>, Error> {
    let mut parser = Parser::new(ddl.as_bytes());
    let mut ret = vec![];

    while let Some(cmd) = parser.next()? {
        match cmd {
            Cmd::Stmt(stmt) => {
                if let Some(record) = maybe_record(stmt)? {
                    ret.push(record)
                }
            }
            _ => {}
        }
    }

    Ok(ret)
}

fn maybe_record(stmt: Stmt) -> Result<Option<NamedRelation>, String> {
    match stmt {
        Stmt::CreateTable { tbl_name, body, .. } => Ok(Some((
            format!("main.{}", util::unquote_ident(&tbl_name.name.0)),
            get_properties(body)?,
        ))),
        _ => Ok(None),
    }
}

fn get_properties(body: CreateTableBody) -> Result<Vec<Col>, String> {
    // TODO: AsSelect would depend on things already defined.
    // We should allow access to that then so we can support AsSelect.
    // The data format should then match what JS provides us when asking for types on queries.
    match body {
        CreateTableBody::AsSelect(_) => {
            Err("Create table via Select is not yet supported".to_string())
        }
        CreateTableBody::ColumnsAndConstraints { columns, .. } => Ok(columns
            .into_iter()
            .map(|c| column_as_property(c))
            .collect::<Vec<Col>>()),
    }
}

// Faithfully return types as specified. The layer above us (TS or Java or ...) will map to their native types.
fn column_as_property(column: ColumnDefinition) -> Col {
    let mut col_type = if let Some(col_type) = column.col_type {
        type_from_type_name(col_type.name)
    } else {
        builtin_type(BuiltinType::Unspecified)
    };
    if !column.constraints.iter().any(|c| match c.constraint {
        ColumnConstraint::NotNull {
            nullable: false, ..
        } => true,
        _ => false,
    }) {
        // no not null constraint
        col_type.extend(builtin_type(BuiltinType::Null))
    }
    (
        util::unquote_ident(&column.col_name.0).to_string(),
        col_type,
    )
}
