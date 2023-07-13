use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
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
    Date,
    Time,
    CurrentDate,
    CurrentTime,
    CurrentTimestamp,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum TypeKind {
    Literal,
    Builtin,
    Custom,
    Unresolved,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum Constraint {
    NotNull,
    Unique,
    PrimaryKey,
    ForeignKey,
}
pub type RelationName = String;
pub type ColName = String;
pub type ColType = Vec<(TypeKind, Option<BuiltinType>, Option<String>)>;
pub type Col = (ColName, ColType);
pub type Relation = (Option<RelationName>, Vec<Col>);
pub type NamedRelation = (RelationName, Vec<Col>);

pub fn builtin_type(c: BuiltinType) -> ColType {
    return vec![(TypeKind::Builtin, Some(c), None)];
}

// This type name could be:
// 1. A SQLite type
// 2. Some string the user injected
pub fn type_from_type_name(type_name: String) -> ColType {
    let lowered = type_name.to_lowercase();

    // ugh........... SQLite and your weird data typing rule.
    // https://www.sqlite.org/datatype3.html
    // So we could follow the SQLite affinity rules but affinity is really a thing at the storage layer.
    // A user that declares a custom type `International` would get affinity `INTEGER` which is bogus for us to return
    // as a type. We'd want to return the custom `International` type back out.
    // Yes, `create table bee (a INTERNATIONAL);` is valid SQLite.
    // I think we'll need to take a departure from SQLite here and only treat
    // `NULL`, `INTEGER`, `REAL`, `TEXT`, `BLOB` as builtins. The rest get assigned `CUSTOM`
    // this'll need a lot of iteration since the SQLite type interface is so undefined.
    if lowered == "integer" || lowered == "int" {
        builtin_type(BuiltinType::Int)
    } else if lowered == "biginteger" || lowered == "bigint" {
        builtin_type(BuiltinType::BigInt)
    } else if lowered == "text" || lowered == "string" {
        builtin_type(BuiltinType::String)
    } else if lowered == "number" {
        builtin_type(BuiltinType::Number)
    } else if lowered == "boolean" {
        builtin_type(BuiltinType::Boolean)
    } else if lowered == "blob" {
        builtin_type(BuiltinType::Blob)
    } else if lowered == "json" {
        // TODO: allow user to reference shapes for json def?
        builtin_type(BuiltinType::Json)
    } else if lowered == "float" || lowered == "double" || lowered == "real" {
        builtin_type(BuiltinType::Float)
    } else if lowered == "date" {
        builtin_type(BuiltinType::Date)
    } else if lowered == "time" || lowered == "timestamp" {
        builtin_type(BuiltinType::Time)
    } else {
        vec![(TypeKind::Custom, None, Some(type_name))]
    }
}

// pub type ComplexRecord = (RecordName, Vec<ComplexProperty>);
// pub type ComplexProperty = (PropertyName, ComplexPropertyType);

// pub enum ComplexPropertyType {
//     BasicType(String),
//     ComplexType(ComplexRecord),
// }
