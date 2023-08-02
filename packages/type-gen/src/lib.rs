mod ddl;
mod error;
mod queries;
mod types;
mod util;

use crate::error::Error;
use std::collections::HashMap;

use types::*;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn get_relation_shapes(schema: String) -> Result<JsValue, JsValue> {
    match ddl::get_relation_shapes(schema) {
        Ok(records) => Ok(serde_wasm_bindgen::to_value(&records)?),
        Err(err) => match err {
            Error::Other(s) | Error::Parse(s) => Err(JsValue::from(s)),
        },
    }
}

#[wasm_bindgen]
pub fn get_query_result_shapes(query: String, schema: JsValue) -> Result<JsValue, JsError> {
    let ddl: Vec<NamedRelation> = serde_wasm_bindgen::from_value(schema)?;
    let record_map: HashMap<_, _> = ddl.into_iter().collect();

    match queries::get_result_shapes(query, record_map) {
        Ok(shape) => Ok(serde_wasm_bindgen::to_value(&shape)?),
        Err(Error::Parse(e)) | Err(Error::Other(e)) => Err(JsError::new(&e)),
    }
}

// #[cfg(test)]
// mod tests {
//     use super::*;

//     #[test]
//     fn it_works() {
//         get_record_shapes_impl("".to_string()).unwrap();
//     }
// }
