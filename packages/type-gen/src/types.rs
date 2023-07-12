use serde::{Deserialize, Serialize};

pub enum BuiltinColType {
    Number,
    Boolean,
    String,
    Blob,
    Json,
    Int,
    Float,
    Any,
    Null,
    QuotedLiteral,
    BigInt,
}

#[derive(Serialize, Deserialize)]
pub enum Constraint {
    NotNull,
    Unique,
    PrimaryKey,
    ForeignKey,
}
pub type RelationName = String;
pub type ColName = String;
pub type ColType = Vec<String>;
pub type Col = (ColName, ColType);
pub type Relation = (Option<RelationName>, Vec<Col>);
pub type NamedRelation = (RelationName, Vec<Col>);

pub fn builtin_col_type_string(c: BuiltinColType) -> String {
    match c {
        BuiltinColType::Blob => "blob".to_string(),
        BuiltinColType::Boolean => "boolean".to_string(),
        BuiltinColType::Json => "json".to_string(),
        BuiltinColType::Number => "number".to_string(),
        BuiltinColType::String => "string".to_string(),
        BuiltinColType::Float => "float".to_string(),
        BuiltinColType::Int => "int".to_string(),
        BuiltinColType::Any => "any".to_string(),
        BuiltinColType::Null => "null".to_string(),
        BuiltinColType::QuotedLiteral => "quoted_literal".to_string(),
        BuiltinColType::BigInt => "bigint".to_string(),
    }
}

// pub type ComplexRecord = (RecordName, Vec<ComplexProperty>);
// pub type ComplexProperty = (PropertyName, ComplexPropertyType);

// pub enum ComplexPropertyType {
//     BasicType(String),
//     ComplexType(ComplexRecord),
// }
