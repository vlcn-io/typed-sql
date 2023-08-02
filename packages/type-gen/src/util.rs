pub fn unquote_ident(s: &str) -> &str {
    if s.starts_with('"') || s.starts_with('[') || s.starts_with('`') {
        &s[1..s.len() - 1]
    } else {
        s
    }
}
