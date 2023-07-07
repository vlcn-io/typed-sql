use fallible_iterator::FallibleIterator;
use js_sys::Array;
use sqlite3_parser::{
    ast::{Cmd, ColumnDefinition, CreateTableBody, Stmt},
    lexer::sql::{Error, Parser},
};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn get_record_shapes(ddl: String) -> Array {
    if let Ok(records) = get_record_shapes_impl(ddl) {
        let ret = Array::new_with_length(records.len() as u32);
        for (i, record) in records.into_iter().enumerate() {
            let js_record = Array::new_with_length(2);
            js_record.set(0, JsValue::from_str(&record.0));
            ret.set(i as u32, js_record);
        }
        ret
    } else {
        // todo: pass error string back
        Array::new_with_length(0)
    }
}

type RecordName = String;
type PropertyName = String;
type PropertyType = Option<String>;
type Record = (RecordName, Vec<Property>);

// wasm_bindgen does not yet support tuples so we have to structify all the things
#[wasm_bindgen]
pub struct Property {
    name: String,
    prop_type: Option<String>,
}
#[wasm_bindgen]
impl Property {
    // nor does it support string type directly without going through getters and setters
    // https://github.com/rustwasm/wasm-bindgen/issues/1775
    #[wasm_bindgen(getter)]
    pub fn name(&mut self) -> String {
        self.name
    }

    #[wasm_bindgen(getter)]
    pub fn prop_type(&mut self) -> Option<String> {
        self.prop_type
    }
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
    Property {
        name: column.col_name.0,
        prop_type: column.col_type.map(|t| t.name),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_works() {
        get_record_shapes_impl("".to_string());
    }
}
