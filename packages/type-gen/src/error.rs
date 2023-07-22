use sqlite3_parser::lexer::sql;

#[derive(PartialEq, Debug)]
pub enum Error {
    Parse(String),
    Other(String),
}

impl core::fmt::Display for Error {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        write!(f, "{:?}", self)
    }
}

impl std::error::Error for Error {}

impl From<sql::Error> for Error {
    fn from(error: sql::Error) -> Self {
        Error::Parse(format!("{:?}", error))
    }
}

impl From<String> for Error {
    fn from(error: String) -> Self {
        Error::Other(error)
    }
}
