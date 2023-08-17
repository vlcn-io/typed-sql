export type Range = [number, number];
export type Replacement = string;
export type Fix = InlineFix | CompanionFileFix;

export type InlineFix = {
  _tag: "InlineFix";
  range: Range;
  replacement: Replacement;
};

export type CompanionFileFix = {
  _tag: "CompanionFileFix";
  path: string;
  content: string;
};
