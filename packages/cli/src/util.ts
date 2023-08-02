import * as ts from "typescript";

export function getChildren(node: ts.Node): ts.Node[] {
  const ret: ts.Node[] = [];
  node.forEachChild((c) => {
    ret.push(c);
  });
  return ret;
}

export function normalize(val: string) {
  // must replace with empty strings otherwise a difference in the _number_ of `;` or ` ` will create a difference in the noramlized strings
  return val.replace(/\s|,|;/g, "").replace(/'|"/g, "'");
}

export function trimTag(tag: string) {
  return tag.substring(1, tag.length - 1);
}

export function replaceRange(
  s: string,
  start: number,
  end: number,
  substitute: string
) {
  return s.slice(0, start) + substitute + s.slice(end);
}
