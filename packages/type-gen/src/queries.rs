use crate::types::*;
use fallible_iterator::FallibleIterator;
use sqlite3_parser::{
    ast::{
        Cmd, Expr, FromClause, Id, JoinOperator, JoinType, OneSelect, Operator, ResultColumn,
        Select, SelectTable, Stmt,
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
                (
                    String::from("addr"),
                    Some(builtin_col_type_string(BuiltinColType::Int)),
                    vec![],
                ),
                (
                    String::from("opcode"),
                    Some(builtin_col_type_string(BuiltinColType::String)),
                    vec![],
                ),
                (
                    String::from("p1"),
                    Some(builtin_col_type_string(BuiltinColType::Int)),
                    vec![],
                ),
                (
                    String::from("p2"),
                    Some(builtin_col_type_string(BuiltinColType::Int)),
                    vec![],
                ),
                (
                    String::from("p3"),
                    Some(builtin_col_type_string(BuiltinColType::Int)),
                    vec![],
                ),
                (
                    String::from("p4"),
                    Some(builtin_col_type_string(BuiltinColType::Int)),
                    vec![],
                ),
                (
                    String::from("p5"),
                    Some(builtin_col_type_string(BuiltinColType::Int)),
                    vec![],
                ),
                (
                    String::from("comment"),
                    Some(builtin_col_type_string(BuiltinColType::String)),
                    vec![],
                ),
            ],
        ))),
        Cmd::ExplainQueryPlan(_) => Ok(Some((
            None,
            vec![(
                String::from("QUERY PLAN"),
                Some(builtin_col_type_string(BuiltinColType::String)),
                vec![],
            )],
        ))),
        Cmd::Stmt(Stmt::Select(select)) => {
            let selection_set = selection_set(&select);
            let from_shape = from_shape(&select, schema);
            let with_relations = with_relations(&select);

            // now craft the result shape by marrying the selection_set with the from_shape.
            // for naked expression selects, determine type of the expression
            // with_relations act as additional schemas atop our base schema
            Ok(None)
        }
        // TODO: update & returning, insert & returning, delete & returning
        Cmd::Stmt(_) => Ok(None),
    }
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
                vec![(None, expressions_to_columns(first, namer))]
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
) -> Vec<Col> {
    expressions
        .iter()
        .enumerate()
        .map(|(i, e)| -> Col { expression_to_column(i, e, &namer) })
        .collect::<Vec<_>>()
}

fn expression_to_column<F: Fn(usize, &Expr) -> String>(
    i: usize,
    expression: &Expr,
    namer: &F,
) -> Col {
    let col_name = namer(i, expression);
    let col_type = expression_to_type(expression);
    (col_name, col_type, vec![])
}

fn expression_to_type(expression: &Expr) -> Option<String> {
    match expression {
        Expr::Binary(_, op, _) => Some(op_to_type(op)),
        Expr::Case {
            when_then_pairs, ..
        } => when_then_to_type(when_then_pairs),
        Expr::Cast { type_name, .. } => Some(type_name.name),
        // DoublyQualified would be processed when the col name is returned then married against relations on which it is applied
        // None type returned at this point since we don't have full information
        Expr::Exists(_) => Some("boolean".to_string()),
        Expr::FunctionCall {
            name: Id(n), args, ..
        } => fn_call_to_type(n, args),
    }
}

// TODO: be more precise on types by considering operands.
fn op_to_type(op: &Operator) -> String {
    match op {
        Operator::Add => builtin_col_type_string(BuiltinColType::Number),
        Operator::And => builtin_col_type_string(BuiltinColType::Boolean),
        Operator::ArrowRight => builtin_col_type_string(BuiltinColType::Json),
        Operator::ArrowRightShift => builtin_col_type_string(BuiltinColType::Any),
        Operator::BitwiseAnd => builtin_col_type_string(BuiltinColType::Number),
        Operator::BitwiseOr => builtin_col_type_string(BuiltinColType::Number),
        Operator::Concat => builtin_col_type_string(BuiltinColType::String),
        Operator::Equals => builtin_col_type_string(BuiltinColType::Boolean),
        Operator::Divide => builtin_col_type_string(BuiltinColType::Number),
        Operator::Greater => builtin_col_type_string(BuiltinColType::Boolean),
        Operator::GreaterEquals => builtin_col_type_string(BuiltinColType::Boolean),
        Operator::Is => builtin_col_type_string(BuiltinColType::Boolean),
        Operator::IsNot => builtin_col_type_string(BuiltinColType::Boolean),
        Operator::LeftShift => builtin_col_type_string(BuiltinColType::Number),
        Operator::Less => builtin_col_type_string(BuiltinColType::Boolean),
        Operator::LessEquals => builtin_col_type_string(BuiltinColType::Boolean),
        Operator::Modulus => builtin_col_type_string(BuiltinColType::Number),
        Operator::Multiply => builtin_col_type_string(BuiltinColType::Number),
        Operator::NotEquals => builtin_col_type_string(BuiltinColType::Boolean),
        Operator::Or => builtin_col_type_string(BuiltinColType::Boolean),
        Operator::RightShift => builtin_col_type_string(BuiltinColType::Number),
        Operator::Substract => builtin_col_type_string(BuiltinColType::Number),
    }
}

fn when_then_to_type(when_then_pairs: &Vec<(Expr, Expr)>) -> Option<String> {
    if let Some(when_then) = when_then_pairs.first() {
        expression_to_type(&when_then.1);
    }
    None
}

fn fn_call_to_type(fn_name: &String, args: &Option<Vec<Expr>>) -> Option<String> {
    let lowered = fn_name.to_lowercase();
    if lowered == "abs" || lowered == "changes" || lowered == "" {
        Some("number".to_string())
    } else if lowered == "char" || lowered == "format" {
        Some("text".to_string())
    } else {
        None
    }
}
