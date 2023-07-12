use crate::types::*;
use fallible_iterator::FallibleIterator;
use sqlite3_parser::{
    ast::{
        Cmd, Expr, FromClause, JoinOperator, JoinType, OneSelect, ResultColumn, Select,
        SelectTable, Stmt,
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
                    Some(affinity_str(Affinity::INTEGER).to_string()),
                ),
                (
                    String::from("opcode"),
                    Some(affinity_str(Affinity::TEXT).to_string()),
                ),
                (
                    String::from("p1"),
                    Some(affinity_str(Affinity::INTEGER).to_string()),
                ),
                (
                    String::from("p2"),
                    Some(affinity_str(Affinity::INTEGER).to_string()),
                ),
                (
                    String::from("p3"),
                    Some(affinity_str(Affinity::INTEGER).to_string()),
                ),
                (
                    String::from("p4"),
                    Some(affinity_str(Affinity::INTEGER).to_string()),
                ),
                (
                    String::from("p5"),
                    Some(affinity_str(Affinity::INTEGER).to_string()),
                ),
                (
                    String::from("comment"),
                    Some(affinity_str(Affinity::TEXT).to_string()),
                ),
            ],
        ))),
        Cmd::ExplainQueryPlan(_) => Ok(Some((
            None,
            vec![(
                String::from("QUERY PLAN"),
                Some(affinity_str(Affinity::TEXT).to_string()),
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
    vec![]
}
