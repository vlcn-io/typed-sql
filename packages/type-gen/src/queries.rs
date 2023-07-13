use crate::types::*;
use fallible_iterator::FallibleIterator;
use sqlite3_parser::{
    ast::{
        As, Cmd, Expr, FromClause, Id, JoinOperator, JoinType, JoinedSelectTable, Literal, Name,
        OneSelect, Operator, QualifiedName, ResultColumn, Select, SelectTable, Stmt, ToTokens,
        TokenStream, UnaryOperator,
    },
    dialect::TokenType,
    lexer::sql::{Error, Parser},
};
use std::collections::HashMap;

// struct Selected {
//     pub qualifier: Option<String>,
//     pub name: String,
//     pub alias: Option<String>,
//     pub t_type: Option<String>,
//     pub c_num: u32,
// }

struct TokenCollector {
    pub parts: Vec<String>,
}

impl TokenCollector {
    pub fn to_string(&self) -> String {
        // spaces or no?
        self.parts.join(" ")
    }
}

impl TokenStream for TokenCollector {
    type Error = String;

    fn append(&mut self, _ty: TokenType, value: Option<&str>) -> Result<(), Self::Error> {
        if let Some(s) = value {
            self.parts.push(s.to_string());
        }

        Ok(())
    }
}

pub fn get_result_shapes(
    query: String,
    // TODO: we need to qualify relation names with `main`
    schema: HashMap<RelationName, Vec<Col>>,
) -> Result<Vec<Relation>, Error> {
    let mut parser = Parser::new(query.as_bytes());
    let mut ret = vec![];

    while let Some(cmd) = parser.next()? {
        if let Some(relation) = get_result_shape(cmd, &schema)? {
            ret.push(relation)
        }
    }

    Ok(ret)
}

fn get_result_shape(
    node: Cmd,
    schema: &HashMap<RelationName, Vec<Col>>,
) -> Result<Option<Relation>, Error> {
    match node {
        Cmd::Explain(_) => Ok(Some((
            None,
            vec![
                (String::from("addr"), builtin_type(BuiltinType::Int)),
                (String::from("opcode"), builtin_type(BuiltinType::String)),
                (String::from("p1"), builtin_type(BuiltinType::Int)),
                (String::from("p2"), builtin_type(BuiltinType::Int)),
                (String::from("p3"), builtin_type(BuiltinType::Int)),
                (String::from("p4"), builtin_type(BuiltinType::Int)),
                (String::from("p5"), builtin_type(BuiltinType::Int)),
                (String::from("comment"), builtin_type(BuiltinType::String)),
            ],
        ))),
        Cmd::ExplainQueryPlan(_) => Ok(Some((
            None,
            vec![(
                String::from("QUERY PLAN"),
                builtin_type(BuiltinType::String),
            )],
        ))),
        Cmd::Stmt(Stmt::Select(select)) => Ok(Some(select_to_relation(&select, &vec![], schema))),
        // TODO: update & returning, insert & returning, delete & returning
        Cmd::Stmt(_) => Ok(None),
    }
}

fn select_to_relation(
    select: &Select,
    outer_from_relations: &Vec<Relation>,
    schema: &HashMap<RelationName, Vec<Col>>,
) -> Relation {
    let selection_set = selection_set(&select);
    // selection set could contain stars
    // if this is the case we pull all columns from all relations in-order and name them.. whatever they were named there.
    let mut from_relations = from_relations(&select, outer_from_relations, schema);
    from_relations.extend(outer_from_relations.clone());
    // TODO: can withs be nested? I don't think so but the current AST allows it.
    let with_relations = with_relations(&select);

    let mut schema = schema.clone();
    schema.extend(with_relations);

    // now craft the result shape by marrying the selection_set with the from_shape.
    // for naked expression selects, determine type of the expression
    // with_relations act as additional schemas atop our base schema

    // if items in the selection set are expression, convert the expression to a type and pair it with a column name

    // selection set is picking items out of from, with and schema.
    // then returning a new relation. This relation may be unnamed.

    let cols = selection_set
        .iter()
        .flat_map(|result_column| -> Vec<Col> {
            match result_column {
                ResultColumn::Expr(e, Some(as_)) => vec![(
                    extract_alias(as_).to_string(),
                    resolve_selection_set_expr_type(e, &from_relations, &schema),
                )],
                ResultColumn::Expr(e, None) => {
                    let mut collector = TokenCollector { parts: vec![] };
                    e.to_tokens(&mut collector).unwrap(); // TokenCollector always returns Ok
                    vec![(
                        collector.to_string(),
                        resolve_selection_set_expr_type(e, &from_relations, &schema),
                    )]
                }
                ResultColumn::Star => {
                    // grab everything exposed by `from_relations`
                    from_relations
                        .iter()
                        .flat_map(|relation| -> Vec<Col> { relation.1.to_vec() })
                        .collect()
                }
                ResultColumn::TableStar(Name(table_name)) => {
                    // grab everything exposed by the chosen table
                    // the chosen table name must exist in from_relations
                    for relation in &from_relations {
                        if let Some(name) = &relation.0 {
                            if table_name == name {
                                return relation.1.to_vec();
                            }
                        }
                    }
                    // TODO: err?
                    vec![]
                }
            }
        })
        .collect();

    (None, cols)
}

fn resolve_selection_set_expr_type(
    e: &Expr,
    from_relations: &Vec<Relation>,
    schema: &HashMap<RelationName, Vec<Col>>,
) -> ColType {
    match e {
        Expr::Name(Name(name)) | Expr::Id(Id(name)) => {
            for relation in from_relations {
                for col in &relation.1 {
                    if &col.0 == name {
                        return col.1.to_vec();
                    }
                }
            }
            vec![]
        }
        Expr::Qualified(Name(table_name), Name(col_name)) => {
            let prefixed = format!("main.{}", table_name);
            for relation in from_relations {
                if let Some(relation_name) = &relation.0 {
                    if &prefixed == relation_name {
                        for col in &relation.1 {
                            if &col.0 == col_name {
                                return col.1.to_vec();
                            }
                        }
                    }
                }
            }
            vec![]
        }
        Expr::DoublyQualified(Name(db_name), Name(table_name), Name(col_name)) => {
            let prefixed = format!("{}.{}", db_name, table_name);
            for relation in from_relations {
                if let Some(relation_name) = &relation.0 {
                    if &prefixed == relation_name {
                        for col in &relation.1 {
                            if &col.0 == col_name {
                                return col.1.to_vec();
                            }
                        }
                    }
                }
            }
            vec![]
        }
        _ => expression_to_type(e, from_relations, schema),
    }
}

fn selection_set(select: &Select) -> Vec<ResultColumn> {
    // we only care about `OneSelect` and not compounds given unions, intersects, etc. must be compatible relations
    match &select.body.select {
        OneSelect::Select { columns, .. } => columns.to_vec(),
        OneSelect::Values(values) => {
            if let Some(values) = values.first() {
                values
                    .iter()
                    .enumerate()
                    .map(|(i, e)| -> ResultColumn {
                        ResultColumn::Expr(e.clone(), Some(As::As(Name(format!("column{}", i)))))
                    })
                    .collect()
            } else {
                // TODO: error?
                vec![]
            }
        }
    }
}

// a vec of relations since many relations can be joined in.
// the returned vec of relations might copy relations from the schema but change their col types due to left vs right vs inner join.
fn from_relations(
    select: &Select,
    outer_from_relations: &Vec<Relation>,
    schema: &HashMap<RelationName, Vec<Col>>,
) -> Vec<Relation> {
    match &select.body.select {
        OneSelect::Select {
            from: Some(FromClause { select, joins, .. }),
            ..
        } => relations_from_from_clause(select, joins, outer_from_relations, schema),
        OneSelect::Values(vals) => {
            // vals are all literal expressions...
            // cols are just numbered `columnN...`
            // the relation is unnamed and unaliased
            if let Some(first) = vals.first() {
                let namer = |i: usize, _e: &Expr| -> String { format!("column{}", i) };
                vec![(
                    None,
                    expressions_to_columns(first, namer, outer_from_relations, schema),
                )]
            } else {
                vec![]
            }
        }
        _ => {
            vec![]
        }
    }
}

fn relations_from_from_clause(
    select: &Option<Box<SelectTable>>,
    joins: &Option<Vec<JoinedSelectTable>>,
    outer_from_relations: &Vec<Relation>,
    schema: &HashMap<RelationName, Vec<Col>>,
) -> Vec<Relation> {
    // join type changes nullability!
    let mut ret = vec![];
    if let Some(selectable) = select {
        ret.push(relation_from_selecttable(
            selectable,
            outer_from_relations,
            schema,
        ));
    }
    if let Some(join_selectables) = joins {
        // for each join --
        // we'd need to go back and mutate the prior relation if the join is a left join.
        // if a right join, update relation as pushed.
        for selectable in join_selectables {
            match selectable.operator {
                JoinOperator::Comma => ret.push(relation_from_selecttable(
                    &selectable.table,
                    outer_from_relations,
                    schema,
                )),
                JoinOperator::TypedJoin {
                    join_type: None, ..
                } => ret.push(relation_from_selecttable(
                    &selectable.table,
                    outer_from_relations,
                    schema,
                )),
                JoinOperator::TypedJoin {
                    join_type: Some(JoinType::Inner),
                    ..
                } => ret.push(relation_from_selecttable(
                    &selectable.table,
                    outer_from_relations,
                    schema,
                )),
                JoinOperator::TypedJoin {
                    join_type: Some(JoinType::Cross),
                    ..
                } => ret.push(relation_from_selecttable(
                    &selectable.table,
                    outer_from_relations,
                    schema,
                )),
                JoinOperator::TypedJoin {
                    join_type: Some(JoinType::Left),
                    ..
                } => handle_left_join(&mut ret, &selectable.table, outer_from_relations, schema),
                JoinOperator::TypedJoin {
                    join_type: Some(JoinType::LeftOuter),
                    ..
                } => handle_left_join(&mut ret, &selectable.table, outer_from_relations, schema),
                JoinOperator::TypedJoin {
                    join_type: Some(JoinType::Right),
                    ..
                } => handle_right_join(&mut ret, &selectable.table, outer_from_relations, schema),
                JoinOperator::TypedJoin {
                    join_type: Some(JoinType::RightOuter),
                    ..
                } => handle_right_join(&mut ret, &selectable.table, outer_from_relations, schema),
                JoinOperator::TypedJoin {
                    join_type: Some(JoinType::Full),
                    ..
                } => handle_full_join(&mut ret, &selectable.table, outer_from_relations, schema),
                JoinOperator::TypedJoin {
                    join_type: Some(JoinType::FullOuter),
                    ..
                } => handle_full_join(&mut ret, &selectable.table, outer_from_relations, schema),
            }
        }
    }
    ret
}

fn make_all_cols_nullable(relation: Relation) -> Relation {
    (
        relation.0,
        relation
            .1
            .iter()
            .map(|c| (c.0.to_string(), make_type_nullable(c.1.clone())))
            .collect(),
    )
}

fn make_type_nullable(mut t: ColType) -> ColType {
    if t.iter().any(|(_, maybe_builtin, _)| match maybe_builtin {
        Some(BuiltinType::Null) => true,
        _ => false,
    }) {
        t
    } else {
        t.extend(builtin_type(BuiltinType::Null));
        t
    }
}

fn handle_full_join(
    ret: &mut Vec<Relation>,
    selectable: &SelectTable,
    outer_from_relations: &Vec<Relation>,
    schema: &HashMap<RelationName, Vec<Col>>,
) {
    if let Some(last_relation) = ret.pop() {
        ret.push(make_all_cols_nullable(last_relation));
    }
    ret.push(make_all_cols_nullable(relation_from_selecttable(
        selectable,
        outer_from_relations,
        schema,
    )));
}

fn handle_right_join(
    ret: &mut Vec<Relation>,
    selectable: &SelectTable,
    outer_from_relations: &Vec<Relation>,
    schema: &HashMap<RelationName, Vec<Col>>,
) {
    if let Some(last_relation) = ret.pop() {
        ret.push(make_all_cols_nullable(last_relation));
    }
    ret.push(relation_from_selecttable(
        selectable,
        outer_from_relations,
        schema,
    ));
}

fn handle_left_join(
    ret: &mut Vec<Relation>,
    selectable: &SelectTable,
    outer_from_relations: &Vec<Relation>,
    schema: &HashMap<RelationName, Vec<Col>>,
) {
    ret.push(make_all_cols_nullable(relation_from_selecttable(
        selectable,
        outer_from_relations,
        schema,
    )));
}

fn relation_from_selecttable(
    selectable: &SelectTable,
    from_relations: &Vec<Relation>,
    schema: &HashMap<RelationName, Vec<Col>>,
) -> Relation {
    match selectable {
        SelectTable::Table(qualified_name, maybe_as, _) => {
            maybe_aliased_table_to_relation(qualified_name, maybe_as, schema)
        }
        SelectTable::TableCall(qualified_name, _, maybe_as) => {
            maybe_aliased_table_to_relation(qualified_name, maybe_as, schema)
        }
        SelectTable::Select(select, maybe_as) => {
            let relation = select_to_relation(select, from_relations, schema);
            if let Some(as_) = maybe_as {
                (Some(format!("main.{}", extract_alias(as_))), relation.1)
            } else {
                relation
            }
        }
        SelectTable::Sub(from, maybe_as) => {
            // a sub yields 1 relation which is the selection set against the provided relations of the sub-query
            // idk, sub doesn't really make sense to me here. Select arm should already cover this.
            let relations =
                relations_from_from_clause(&from.select, &from.joins, from_relations, schema);
            // TODO: what if many relations in this position?
            if let Some(first) = relations.first() {
                if let Some(as_) = maybe_as {
                    (
                        Some(format!("main.{}", extract_alias(as_))),
                        first.1.to_vec(),
                    )
                } else {
                    first.clone()
                }
            } else {
                (None, vec![])
            }
        }
    }
}

fn maybe_aliased_table_to_relation(
    qualified_name: &QualifiedName,
    maybe_as: &Option<As>,
    schema: &HashMap<RelationName, Vec<Col>>,
) -> Relation {
    if let Some(as_) = maybe_as {
        let alias = extract_alias(as_);
        let canonical_name = normalize_qualified_name(qualified_name);
        let cols = schema
            .get(&canonical_name)
            .map_or(vec![], |f| -> Vec<Col> { f.to_vec() });
        (Some(format!("main.{}", alias)), cols)
    } else {
        let canonical_name = normalize_qualified_name(qualified_name);
        let cols = schema
            .get(&canonical_name)
            .map_or(vec![], |f| -> Vec<Col> { f.to_vec() });
        (Some(canonical_name), cols)
    }
}

fn extract_alias(as_: &As) -> &String {
    match as_ {
        As::As(n) => &n.0,
        As::Elided(n) => &n.0,
    }
}

fn normalize_qualified_name(name: &QualifiedName) -> String {
    let db_name = &name.db_name;
    format!(
        "{}.{}",
        if let Some(name) = db_name {
            name.0.to_string()
        } else {
            "main".to_string()
        },
        name.name.0,
    )
}

fn with_relations(_select: &Select) -> HashMap<RelationName, Vec<Col>> {
    // TODO: impl with_relations
    HashMap::new()
}

fn expressions_to_columns<F: Fn(usize, &Expr) -> String>(
    expressions: &Vec<Expr>,
    namer: F,
    from_relations: &Vec<Relation>,
    schema: &HashMap<RelationName, Vec<Col>>,
) -> Vec<Col> {
    expressions
        .iter()
        .enumerate()
        .map(|(i, e)| -> Col { expression_to_column(i, e, &namer, from_relations, schema) })
        .collect::<Vec<_>>()
}

fn expression_to_column<F: Fn(usize, &Expr) -> String>(
    i: usize,
    expression: &Expr,
    namer: &F,
    from_relations: &Vec<Relation>,
    schema: &HashMap<RelationName, Vec<Col>>,
) -> Col {
    let col_name = namer(i, expression);
    let col_type = expression_to_type(expression, from_relations, schema);
    (col_name, col_type)
}

// TODO: should this not have access to from_relations if it exists?
fn expression_to_type(
    expression: &Expr,
    from_relations: &Vec<Relation>,
    schema: &HashMap<RelationName, Vec<Col>>,
) -> ColType {
    match expression {
        Expr::Binary(_, op, _) => op_to_type(op),
        Expr::Case {
            when_then_pairs, ..
        } => when_then_to_type(when_then_pairs, from_relations, schema),
        Expr::Cast { type_name, .. } => type_from_type_name(type_name.name.to_string()),
        // DoublyQualified would be processed when the col name is returned then married against relations on which it is applied
        // None type returned at this point since we don't have full information
        Expr::Exists(_) => builtin_type(BuiltinType::Boolean),
        Expr::FunctionCall {
            name: Id(n), args, ..
        } => fn_call_to_type(n, args),
        Expr::FunctionCallStar { name: Id(n), .. } => fn_call_to_type(n, &None),
        Expr::Id(_) => vec![], // unresolved type. Will get resolved in a later step
        Expr::InList { .. } => builtin_type(BuiltinType::Boolean),
        Expr::InSelect { .. } => builtin_type(BuiltinType::Boolean),
        Expr::InTable { .. } => builtin_type(BuiltinType::Boolean),
        Expr::IsNull { .. } => builtin_type(BuiltinType::Boolean),
        Expr::Like { .. } => builtin_type(BuiltinType::Boolean),
        Expr::Literal(lit) => literal_to_type(lit),
        Expr::Name(_) => vec![], // unresolved type. Will get resolved in a later step.
        Expr::NotNull { .. } => builtin_type(BuiltinType::Boolean),
        Expr::Parenthesized(expr) => subexpression_to_type(expr, from_relations, schema),
        Expr::Qualified(_, _) => vec![],
        Expr::DoublyQualified(_, _, _) => vec![],
        Expr::Subquery(select) => subquery_to_type(select, from_relations, schema), // a subquery in this position can only return 1 row 1 col
        Expr::Unary(op, _) => unary_op_to_type(op),
        _ => vec![],
    }
}

// TODO: be more precise on types by considering operands.
fn op_to_type(op: &Operator) -> ColType {
    match op {
        Operator::Add => builtin_type(BuiltinType::Number),
        Operator::And => builtin_type(BuiltinType::Boolean),
        Operator::ArrowRight => builtin_type(BuiltinType::Json),
        Operator::ArrowRightShift => builtin_type(BuiltinType::Any),
        Operator::BitwiseAnd => builtin_type(BuiltinType::Number),
        Operator::BitwiseOr => builtin_type(BuiltinType::Number),
        Operator::Concat => builtin_type(BuiltinType::String),
        Operator::Equals => builtin_type(BuiltinType::Boolean),
        Operator::Divide => builtin_type(BuiltinType::Number),
        Operator::Greater => builtin_type(BuiltinType::Boolean),
        Operator::GreaterEquals => builtin_type(BuiltinType::Boolean),
        Operator::Is => builtin_type(BuiltinType::Boolean),
        Operator::IsNot => builtin_type(BuiltinType::Boolean),
        Operator::LeftShift => builtin_type(BuiltinType::Number),
        Operator::Less => builtin_type(BuiltinType::Boolean),
        Operator::LessEquals => builtin_type(BuiltinType::Boolean),
        Operator::Modulus => builtin_type(BuiltinType::Number),
        Operator::Multiply => builtin_type(BuiltinType::Number),
        Operator::NotEquals => builtin_type(BuiltinType::Boolean),
        Operator::Or => builtin_type(BuiltinType::Boolean),
        Operator::RightShift => builtin_type(BuiltinType::Number),
        Operator::Substract => builtin_type(BuiltinType::Number),
    }
}

// TODO: technically we should differentiate against the operand so we can return bigint vs int vs whatever
fn unary_op_to_type(op: &UnaryOperator) -> ColType {
    match op {
        UnaryOperator::BitwiseNot => builtin_type(BuiltinType::Number),
        UnaryOperator::Negative => builtin_type(BuiltinType::Number),
        UnaryOperator::Not => builtin_type(BuiltinType::Boolean),
        UnaryOperator::Positive => builtin_type(BuiltinType::Number),
    }
}

fn when_then_to_type(
    when_then_pairs: &Vec<(Expr, Expr)>,
    from_relations: &Vec<Relation>,
    schema: &HashMap<RelationName, Vec<Col>>,
) -> ColType {
    // TODO: error on missing when_then_pairs?
    if let Some(when_then) = when_then_pairs.first() {
        expression_to_type(&when_then.1, from_relations, schema);
    }
    vec![]
}

// Type needs to be more than a string given nullability is involved.
// It doesn't need to be option given we have `any`
fn fn_call_to_type(fn_name: &String, _args: &Option<Vec<Expr>>) -> ColType {
    let lowered = fn_name.to_lowercase();
    if lowered == "abs" {
        builtin_type(BuiltinType::Number)
    } else if lowered == "char"
        || lowered == "format"
        || lowered == "glob"
        || lowered == "hex"
        || lowered == "lower"
        || lowered == "ltrim"
        || lowered == "printf"
        || lowered == "rtrim"
        || lowered == "soundex"
        || lowered == "sqlite_compileoption_get"
        || lowered == "sqlite_source_id"
        || lowered == "sqlite_version"
        || lowered == "substr"
        || lowered == "substring"
        || lowered == "trim"
        || lowered == "typeof"
        || lowered == "upper"
    {
        builtin_type(BuiltinType::String)
    } else if lowered == "coalesce"
        || lowered == "ifnull"
        || lowered == "max"
        || lowered == "min"
        || lowered == "nullif"
    {
        // type is union of arguments and null
        vec![]
    } else if lowered == "iif" {
        // TODO - type is union of arguments
        vec![]
    } else if lowered == "quote" {
        // TODO: we could take the args to quote and return Quoted<GENERIC>
        // so ColType should have a palceholder for generics?
        builtin_type(BuiltinType::Quoted)
    } else if lowered == "random"
        || lowered == "last_insert_rowid"
        || lowered == "sqlite_offset"
        || lowered == "total_changes"
    {
        // TS layer should understand this is number | bigint
        builtin_type(BuiltinType::BigInt)
    } else if lowered == "randomblob" || lowered == "unhex" || lowered == "zeroblob" {
        builtin_type(BuiltinType::Blob)
    } else if lowered == "insrt"
        || lowered == "length"
        || lowered == "changes"
        || lowered == "sign"
        || lowered == "unicode"
    {
        builtin_type(BuiltinType::Int)
    } else if lowered == "round" {
        builtin_type(BuiltinType::Float)
    } else if lowered == "sqlite_compileoption_used" {
        builtin_type(BuiltinType::Boolean)
    } else {
        vec![]
    }
}

fn literal_to_type(lit: &Literal) -> ColType {
    match lit {
        Literal::Numeric(l) => vec![(
            TypeKind::Literal,
            Some(BuiltinType::Number),
            Some(l.to_string()),
        )],
        Literal::String(l) => vec![(
            TypeKind::Literal,
            Some(BuiltinType::String),
            Some(l.to_string()),
        )],
        Literal::Blob(l) => vec![(
            TypeKind::Literal,
            Some(BuiltinType::Blob),
            Some(l.to_string()),
        )],
        // TODO: what does it mean for a keyword literal to exist in a position the should result in a value?
        Literal::Keyword(l) => vec![(TypeKind::Literal, None, Some(l.to_string()))],
        Literal::Null => builtin_type(BuiltinType::Null),
        Literal::CurrentDate => vec![(TypeKind::Literal, Some(BuiltinType::CurrentDate), None)],
        Literal::CurrentTime => vec![(TypeKind::Literal, Some(BuiltinType::CurrentTime), None)],
        Literal::CurrentTimestamp => {
            vec![(TypeKind::Literal, Some(BuiltinType::CurrentTimestamp), None)]
        }
    }
}

fn subexpression_to_type(
    expressions: &Vec<Expr>,
    from_relations: &Vec<Relation>,
    schema: &HashMap<RelationName, Vec<Col>>,
) -> ColType {
    // ok, this is weird that it is an array of expressions to refer to a sub-expression.
    // it seems like there should only ever be one sub-expression if this appears in a position that can emit a result type.
    // TODO: error on many expressions?
    if let Some(e) = expressions.first() {
        expression_to_type(e, from_relations, schema)
    } else {
        vec![]
    }
}

// A subquery in a type position can only return a single column so it has a single type.
fn subquery_to_type(
    query: &Box<Select>,
    outer_from_relations: &Vec<Relation>,
    schema: &HashMap<RelationName, Vec<Col>>,
) -> ColType {
    let subquery_relation = select_to_relation(query, outer_from_relations, schema);
    // TODO: error on many columns?
    if let Some(col) = subquery_relation.1.first() {
        col.1.to_vec()
    } else {
        vec![]
    }
}

#[cfg(test)]
mod tests {
    use crate::ddl;

    use super::*;

    #[test]
    fn select_star_single_table_nullable() {
        let schema_shapes =
            ddl::get_relation_shapes("CREATE TABLE foo (a INTEGER, b TEXT);".to_string()).unwrap();
        let schema: HashMap<_, _> = schema_shapes.into_iter().collect();

        let query_shapes = get_result_shapes("SELECT * FROM foo".to_string(), schema).unwrap();
        assert_eq!(
            query_shapes,
            vec![(
                None,
                vec![
                    (
                        "a".to_string(),
                        vec![
                            (TypeKind::Builtin, Some(BuiltinType::Int), None),
                            (TypeKind::Builtin, Some(BuiltinType::Null), None)
                        ]
                    ),
                    (
                        "b".to_string(),
                        vec![
                            (TypeKind::Builtin, Some(BuiltinType::String), None),
                            (TypeKind::Builtin, Some(BuiltinType::Null), None)
                        ]
                    )
                ]
            )]
        )
    }

    #[test]
    fn select_start_single_table_not_null() {
        let schema_shapes = ddl::get_relation_shapes(
            "CREATE TABLE foo (a INTEGER NOT NULL, b TEXT NOT NULL);".to_string(),
        )
        .unwrap();
        let schema: HashMap<_, _> = schema_shapes.into_iter().collect();

        let query_shapes = get_result_shapes("SELECT * FROM foo".to_string(), schema).unwrap();
        assert_eq!(
            query_shapes,
            vec![(
                None,
                vec![
                    (
                        "a".to_string(),
                        vec![(TypeKind::Builtin, Some(BuiltinType::Int), None),]
                    ),
                    (
                        "b".to_string(),
                        vec![(TypeKind::Builtin, Some(BuiltinType::String), None),]
                    )
                ]
            )]
        )
    }

    #[test]
    fn select_named_single_table() {
        let schema_shapes = ddl::get_relation_shapes(
            "CREATE TABLE foo (a INTEGER NOT NULL, b TEXT NOT NULL);".to_string(),
        )
        .unwrap();
        let schema: HashMap<_, _> = schema_shapes.into_iter().collect();

        let query_shapes = get_result_shapes("SELECT a, b FROM foo".to_string(), schema).unwrap();
        assert_eq!(
            query_shapes,
            vec![(
                None,
                vec![
                    (
                        "a".to_string(),
                        vec![(TypeKind::Builtin, Some(BuiltinType::Int), None),]
                    ),
                    (
                        "b".to_string(),
                        vec![(TypeKind::Builtin, Some(BuiltinType::String), None),]
                    )
                ]
            )]
        )
    }

    #[test]
    fn select_named_reverse_order_single_tabe() {
        let schema_shapes = ddl::get_relation_shapes(
            "CREATE TABLE foo (a INTEGER NOT NULL, b TEXT NOT NULL);".to_string(),
        )
        .unwrap();
        let schema: HashMap<_, _> = schema_shapes.into_iter().collect();

        let query_shapes = get_result_shapes("SELECT b, a FROM foo".to_string(), schema).unwrap();
        assert_eq!(
            query_shapes,
            vec![(
                None,
                vec![
                    (
                        "b".to_string(),
                        vec![(TypeKind::Builtin, Some(BuiltinType::String), None),]
                    ),
                    (
                        "a".to_string(),
                        vec![(TypeKind::Builtin, Some(BuiltinType::Int), None),]
                    ),
                ]
            )]
        )
    }

    #[test]
    fn select_star_inner_joins() {
        let schema_shapes = ddl::get_relation_shapes(
            "CREATE TABLE foo (a INTEGER NOT NULL, b TEXT NOT NULL);
            CREATE TABLE bar (c ANY NOT NULL, d ANY NOT NULL);
            CREATE TABLE baz (e NOT NULL, f NOT NULL);"
                .to_string(),
        )
        .unwrap();
        let schema: HashMap<_, _> = schema_shapes.into_iter().collect();

        let query_shapes =
            get_result_shapes("SELECT * FROM foo JOIN bar JOIN baz".to_string(), schema).unwrap();
        assert_eq!(
            query_shapes,
            vec![(
                None,
                vec![
                    (
                        "a".to_string(),
                        vec![(TypeKind::Builtin, Some(BuiltinType::Int), None)]
                    ),
                    (
                        "b".to_string(),
                        vec![(TypeKind::Builtin, Some(BuiltinType::String), None)]
                    ),
                    (
                        "c".to_string(),
                        vec![(TypeKind::Builtin, Some(BuiltinType::Any), None)]
                    ),
                    (
                        "d".to_string(),
                        vec![(TypeKind::Builtin, Some(BuiltinType::Any), None)]
                    ),
                    (
                        "e".to_string(),
                        vec![(TypeKind::Builtin, Some(BuiltinType::Unspecified), None)]
                    ),
                    (
                        "f".to_string(),
                        vec![(TypeKind::Builtin, Some(BuiltinType::Unspecified), None)]
                    )
                ]
            )]
        )
    }

    // test aliases
    // test join without join (comma join)
    // it'd probably be easier to test this stuff fomr TypeScript. Much less verbose.
}
