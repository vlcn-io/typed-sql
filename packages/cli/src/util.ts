import * as ts from "typescript";

export function getChildren(node: ts.Node): ts.Node[] {
  const ret: ts.Node[] = [];
  node.forEachChild((c) => {
    ret.push(c);
  });
  return ret;
}

export function normalize(val: string) {
  return val.trim().replace(/\s/g, " ").replace(/,|;/g, "");
}

export function trimTag(tag: string) {
  return tag.substring(1, tag.length - 1);
}
