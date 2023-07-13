use crate::types::*;
use fallible_iterator::FallibleIterator;
use sqlite3_parser::{
    ast::{
        Cmd, Expr, FromClause, Id, JoinOperator, JoinType, Literal, OneSelect, Operator,
        ResultColumn, Select, SelectTable, Stmt, UnaryOperator,
    },
    lexer::sql::{Error, Parser},
};
use std::collections::HashMap;

struct Selected {
    pub qualifier: Option<String>,
    pub name: String,
    pub alias: Option<String>,
    pub t_type: Option<String>,
    pub c_num: u32,
}

pub fn get_result_shapes(
    query: String,
    schema: HashMap<RelationName, Vec<Col>>,
) -> Result<Relation, Error> {
    let mut parser = Parser::new(query.as_bytes());
    let mut ret = vec![];

    while let Some(cmd) = parser.next()? {
        ret.push(get_result_shape(cmd, &schema))
    }

    Ok((Some("rec".to_string()), vec![]))
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
        Cmd::Stmt(Stmt::Select(select)) => Ok(Some(select_to_relation(&select, schema))),
        // TODO: update & returning, insert & returning, delete & returning
        Cmd::Stmt(_) => Ok(None),
    }
}

fn select_to_relation(select: &Select, schema: &HashMap<RelationName, Vec<Col>>) -> Relation {
    let selection_set = selection_set(&select);
    let from_shape = from_shape(&select, schema);
    // TODO: can withs be nested?
    let with_relations = with_relations(&select);

    // now craft the result shape by marrying the selection_set with the from_shape.
    // for naked expression selects, determine type of the expression
    // with_relations act as additional schemas atop our base schema
    (None, vec![])
}

fn selection_set(select: &Select) -> Vec<ResultColumn> {
    vec![]
}

// a vec of relations since many relations can be joined in.
// the returned vec of relations might copy relations from the schema but change their col types due to left vs right vs inner join.
fn from_shape(select: &Select, schema: &HashMap<RelationName, Vec<Col>>) -> Vec<Relation> {
    match &select.body.select {
        OneSelect::Select {
            from: Some(FromClause { select, joins, .. }),
            ..
        } => {
            // join type changes nullability!
            let mut ret = vec![];
            if let Some(selectable) = select {
                ret.push(relation_from_selectable(selectable, schema));
            }
            if let Some(join_selectables) = joins {
                // for each join --
                // we'd need to go back and mutate the prior relation if the join is a left join.
                // if a right join, update relation as pushed.
                for selectable in join_selectables {
                    match selectable.operator {
                        JoinOperator::Comma => {
                            ret.push(relation_from_selectable(&selectable.table, schema))
                        }
                        JoinOperator::TypedJoin {
                            join_type: None, ..
                        } => ret.push(relation_from_selectable(&selectable.table, schema)),
                        JoinOperator::TypedJoin {
                            join_type: Some(JoinType::Inner),
                            ..
                        } => ret.push(relation_from_selectable(&selectable.table, schema)),
                        JoinOperator::TypedJoin {
                            join_type: Some(JoinType::Cross),
                            ..
                        } => ret.push(relation_from_selectable(&selectable.table, schema)),
                        JoinOperator::TypedJoin {
                            join_type: Some(JoinType::Left),
                            ..
                        } => handle_left_join(&mut ret, &selectable.table, schema),
                        JoinOperator::TypedJoin {
                            join_type: Some(JoinType::LeftOuter),
                            ..
                        } => handle_left_join(&mut ret, &selectable.table, schema),
                        JoinOperator::TypedJoin {
                            join_type: Some(JoinType::Right),
                            ..
                        } => handle_right_join(&mut ret, &selectable.table, schema),
                        JoinOperator::TypedJoin {
                            join_type: Some(JoinType::RightOuter),
                            ..
                        } => handle_right_join(&mut ret, &selectable.table, schema),
                        JoinOperator::TypedJoin {
                            join_type: Some(JoinType::Full),
                            ..
                        } => handle_full_join(&mut ret, &selectable.table, schema),
                        JoinOperator::TypedJoin {
                            join_type: Some(JoinType::FullOuter),
                            ..
                        } => handle_full_join(&mut ret, &selectable.table, schema),
                    }
                }
            }
            ret
        }
        OneSelect::Values(vals) => {
            // vals are all literal expressions...
            // cols are just numbered `columnN...`
            // the relation is unnamed and unaliased
            if let Some(first) = vals.first() {
                let namer = |i: usize, _e: &Expr| -> String { format!("column{}", i) };
                vec![(None, expressions_to_columns(first, namer, schema))]
            } else {
                vec![]
            }
        }
        _ => {
            vec![]
        }
    }
}

fn handle_full_join(
    relations: &mut Vec<Relation>,
    selectable: &SelectTable,
    schema: &HashMap<RelationName, Vec<Col>>,
) {
    // let new_relation = make_all_nullable(relation_from_selectable(selectable, schema));
}

// fn make_all_nullable(relation: Relation) -> Relation {
//   (relation.0, relation.1.iter().map(|col| -> {
//     (col.0, if let Some(t) = col.1 {

//     } else {
//       col.1
//     })
//   }))
// }

fn handle_left_join(
    relations: &mut Vec<Relation>,
    selectable: &SelectTable,
    schema: &HashMap<RelationName, Vec<Col>>,
) {
}
fn handle_right_join(
    relations: &mut Vec<Relation>,
    selectable: &SelectTable,
    schema: &HashMap<RelationName, Vec<Col>>,
) {
}

fn relation_from_selectable(
    selectable: &SelectTable,
    schema: &HashMap<RelationName, Vec<Col>>,
) -> Relation {
    (None, vec![])
}

fn with_relations(select: &Select) -> HashMap<RelationName, Vec<Col>> {
    HashMap::new()
}

fn expressions_to_columns<F: Fn(usize, &Expr) -> String>(
    expressions: &Vec<Expr>,
    namer: F,
    schema: &HashMap<RelationName, Vec<Col>>,
) -> Vec<Col> {
    expressions
        .iter()
        .enumerate()
        .map(|(i, e)| -> Col { expression_to_column(i, e, &namer, schema) })
        .collect::<Vec<_>>()
}

fn expression_to_column<F: Fn(usize, &Expr) -> String>(
    i: usize,
    expression: &Expr,
    namer: &F,
    schema: &HashMap<RelationName, Vec<Col>>,
) -> Col {
    let col_name = namer(i, expression);
    let col_type = expression_to_type(expression, schema);
    (col_name, col_type)
}

fn expression_to_type(expression: &Expr, schema: &HashMap<RelationName, Vec<Col>>) -> ColType {
    match expression {
        Expr::Binary(_, op, _) => op_to_type(op),
        Expr::Case {
            when_then_pairs, ..
        } => when_then_to_type(when_then_pairs, schema),
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
        Expr::Parenthesized(expr) => subexpression_to_type(expr, schema),
        Expr::Qualified(_, _) => vec![],
        Expr::Subquery(select) => subquery_to_type(select, schema), // a subquery in this position can only return 1 row 1 col
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
    schema: &HashMap<RelationName, Vec<Col>>,
) -> ColType {
    // TODO: error on missing when_then_pairs?
    if let Some(when_then) = when_then_pairs.first() {
        expression_to_type(&when_then.1, schema);
    }
    vec![]
}

// Type needs to be more than a string given nullability is involved.
// It doesn't need to be option given we have `any`
fn fn_call_to_type(fn_name: &String, args: &Option<Vec<Expr>>) -> ColType {
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
    schema: &HashMap<RelationName, Vec<Col>>,
) -> ColType {
    // ok, this is weird that it is an array of expressions to refer to a sub-expression.
    // it seems like there should only ever be one sub-expression if this appears in a position that can emit a result type.
    // TODO: error on many expressions?
    if let Some(e) = expressions.first() {
        expression_to_type(e, schema)
    } else {
        vec![]
    }
}

// A subquery in a type position can only return a single column so it has a single type.
fn subquery_to_type(query: &Box<Select>, schema: &HashMap<RelationName, Vec<Col>>) -> ColType {
    let subquery_relation = select_to_relation(query, schema);
    // TODO: error on many columns?
    if let Some(col) = subquery_relation.1.first() {
        col.1.to_vec()
    } else {
        vec![]
    }
}
