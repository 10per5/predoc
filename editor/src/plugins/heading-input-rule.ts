import { $inputRule } from "@milkdown/utils";
import { textblockTypeInputRule } from "prosemirror-inputrules";
import { headingSchema } from "@milkdown/preset-commonmark";

export const fixedHeadingInputRule = $inputRule((ctx) => {
  return textblockTypeInputRule(
    /^(?<hashes>#+)\s$/,
    headingSchema.type(ctx),
    (match) => {
      const x = match.groups?.hashes?.length || 0;
      return { level: x };
    },
  );
});
