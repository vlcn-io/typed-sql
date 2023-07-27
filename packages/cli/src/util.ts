import * as ts from "typescript";

export function getChildren(node: ts.Node): ts.Node[] {
  const ret: ts.Node[] = [];
  node.forEachChild((c) => {
    ret.push(c);
  });
  return ret;
}

// TODO: test to ensure all forms of sapcing are caught.
export function normalize(val: string) {
  return val.replace(/\s/g, " ").replace(/,|;/g, ";");
}

export function trimTag(tag: string) {
  return tag.substring(1, tag.length - 1);
}
