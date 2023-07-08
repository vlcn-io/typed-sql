pub type RelationName = String;
pub type ColName = String;
pub type ColType = Option<String>;
pub type Col = (ColName, ColType);
pub type Relation = (RelationName, Vec<Col>);
// pub type ComplexRecord = (RecordName, Vec<ComplexProperty>);
// pub type ComplexProperty = (PropertyName, ComplexPropertyType);

// pub enum ComplexPropertyType {
//     BasicType(String),
//     ComplexType(ComplexRecord),
// }
