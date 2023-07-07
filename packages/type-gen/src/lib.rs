use js_sys::Array;
use sqlite3_parser::lexer::sql::Parser;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn get_record_shapes(ddl: String) -> Array {
    let records = get_record_shapes_impl(ddl);
    let arr = Array::new_with_length(10);
    arr
    // for i in 0..arr.length() {
    //     let s = JsValue::from_str(&format!("str {}", i));
    //     arr.set(i, s);
    // }
    // arr
}

type RecordName = String;
type PropertyName = String;
type PropertyType = String;
type Property = (PropertyName, PropertyType);
type Record = (RecordName, Vec<Property>);

fn get_record_shapes_impl(ddl: String) -> Vec<(RecordName, Record)> {
    vec![]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_works() {
        get_record_shapes_impl("".to_string());
    }
}
