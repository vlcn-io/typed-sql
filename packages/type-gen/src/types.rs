pub enum Affinity {
    INTEGER,
    TEXT,
    BLOB,
    REAL,
    NUMERIC,
}
pub type RelationName = String;
pub type ColName = String;
pub type ColType = Option<String>;
pub type Col = (ColName, ColType);
pub type Relation = (Option<RelationName>, Vec<Col>);
pub type NamedRelation = (RelationName, Vec<Col>);

pub fn affinity_str(a: Affinity) -> &'static str {
    match a {
        Affinity::BLOB => "BLOB",
        Affinity::INTEGER => "INTEGER",
        Affinity::NUMERIC => "NUMERIC",
        Affinity::REAL => "REAL",
        Affinity::TEXT => "TEXT",
    }
}

// pub type ComplexRecord = (RecordName, Vec<ComplexProperty>);
// pub type ComplexProperty = (PropertyName, ComplexPropertyType);

// pub enum ComplexPropertyType {
//     BasicType(String),
//     ComplexType(ComplexRecord),
// }
