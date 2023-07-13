use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub enum BuiltinType {
    Number,
    Boolean,
    String,
    Blob,
    Json,
    Int,
    Float,
    Any,
    Null,
    Quoted,
    BigInt,
    Unspecified,
}

#[derive(Serialize, Deserialize)]
pub enum TypeKind {
    Literal,
    Builtin,
    Custom,
    Unresolved,
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
pub type ColType = Vec<(TypeKind, String)>;
pub type Col = (ColName, ColType);
pub type Relation = (Option<RelationName>, Vec<Col>);
pub type NamedRelation = (RelationName, Vec<Col>);

pub fn builtin_type_string(c: BuiltinType) -> String {
    match c {
        BuiltinType::Blob => "blob".to_string(),
        BuiltinType::Boolean => "boolean".to_string(),
        BuiltinType::Json => "json".to_string(),
        BuiltinType::Number => "number".to_string(),
        BuiltinType::String => "string".to_string(),
        BuiltinType::Float => "float".to_string(),
        BuiltinType::Int => "int".to_string(),
        BuiltinType::Any => "any".to_string(),
        BuiltinType::Null => "null".to_string(),
        BuiltinType::Quoted => "quoted_literal".to_string(),
        BuiltinType::BigInt => "bigint".to_string(),
        BuiltinType::Unspecified => "unspecified".to_string(),
    }
}

pub fn builtin_type(c: BuiltinType) -> ColType {
    return vec![(TypeKind::Builtin, builtin_type_string(c))];
}

// This type name could be:
// 1. A SQLite type
// 2. Some string the user injected
pub fn type_from_type_name(type_name: String) -> ColType {
    vec![]
}

// pub type ComplexRecord = (RecordName, Vec<ComplexProperty>);
// pub type ComplexProperty = (PropertyName, ComplexPropertyType);

// pub enum ComplexPropertyType {
//     BasicType(String),
//     ComplexType(ComplexRecord),
// }
