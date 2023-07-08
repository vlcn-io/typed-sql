use std::collections::HashMap;

use fallible_iterator::FallibleIterator;
use sqlite3_parser::{
    ast::{Cmd, ColumnDefinition, CreateTableBody, Stmt},
    lexer::sql::{Error, Parser},
};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn get_record_shapes(ddl: String) -> Result<JsValue, JsValue> {
    match get_record_shapes_impl(ddl) {
        Ok(records) => Ok(serde_wasm_bindgen::to_value(&records)?),
        Err(err) => match err {
            Error::Io(_) => Err(JsValue::from_str("IOError")),
            Error::UnrecognizedToken(_) => Err(JsValue::from_str("UnrecognizedToken")),
            Error::ParserError(_, _) => Err(JsValue::from_str("ParseError")),
            _ => Err(JsValue::from_str("UnknownError")),
        },
    }
}

pub fn get_query_shapes(query: String, schema: JsValue) -> Result<JsValue, JsValue> {
    let ddl: Vec<Record> = serde_wasm_bindgen::from_value(schema)?;
    let recordMap: HashMap<_, _> = ddl.into_iter().collect();

    let ret = get_query_shapes_impl(query, recordMap);
    Ok(JsValue::from_str("Ok"))
}

type RecordName = String;
type PropertyName = String;
type PropertyType = Option<String>;
type Property = (PropertyName, PropertyType);
type Record = (RecordName, Vec<Property>);
type ComplexRecord = (RecordName, Vec<ComplexProperty>);
type ComplexProperty = (PropertyName, ComplexPropertyType);

enum ComplexPropertyType {
    BasicType(String),
    ComplexType(ComplexRecord),
}

struct Selected {
    pub qualifier: Option<String>,
    pub name: String,
    pub alias: Option<String>,
    pub t_type: Option<String>,
    pub c_num: u32,
}

fn get_query_shapes_impl(
    query: String,
    schema: HashMap<RecordName, Vec<Property>>,
) -> Result<Record, Error> {
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

    Ok(("rec".to_string(), vec![]))
}

fn get_record_shapes_impl(ddl: String) -> Result<Vec<Record>, Error> {
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

fn maybe_record(stmt: Stmt) -> Option<Record> {
    match stmt {
        Stmt::CreateTable { tbl_name, body, .. } => Some((tbl_name.name.0, get_properties(body))),
        _ => None,
    }
}

fn get_properties(body: CreateTableBody) -> Vec<Property> {
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
            .collect::<Vec<Property>>(),
    }
}

// Faithfully return types as specified. The layer above us (TS or Java or ...) will map to their native types.
fn column_as_property(column: ColumnDefinition) -> Property {
    (column.col_name.0, column.col_type.map(|t| t.name))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_works() {
        get_record_shapes_impl("".to_string()).unwrap();
    }
}
