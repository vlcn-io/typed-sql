mod ddl;
mod queries;
mod types;

use std::collections::HashMap;

use sqlite3_parser::lexer::sql::Error;
use types::*;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn get_relation_shapes(schema: String) -> Result<JsValue, JsValue> {
    match ddl::get_relation_shapes(schema) {
        Ok(records) => Ok(serde_wasm_bindgen::to_value(&records)?),
        Err(err) => match err {
            Error::Io(_) => Err(JsValue::from_str("IOError")),
            Error::UnrecognizedToken(_) => Err(JsValue::from_str("UnrecognizedToken")),
            Error::ParserError(_, _) => Err(JsValue::from_str("ParseError")),
            _ => Err(JsValue::from_str("UnknownError")),
        },
    }
}

#[wasm_bindgen]
pub fn get_query_result_shapes(query: String, schema: JsValue) -> Result<JsValue, JsValue> {
    let ddl: Vec<Relation> = serde_wasm_bindgen::from_value(schema)?;
    let record_map: HashMap<_, _> = ddl.into_iter().collect();

    let ret = queries::get_result_shapes(query, record_map);
    Ok(JsValue::from_str("Ok"))
}

// #[cfg(test)]
// mod tests {
//     use super::*;

//     #[test]
//     fn it_works() {
//         get_record_shapes_impl("".to_string()).unwrap();
//     }
// }
