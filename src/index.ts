import type { Plugin } from "graphile-build";
import { AddSortNullsEnumPlugin } from "./AddSortNullsEnumPlugin";
import { ConnectionArgSortPlugin } from "./ConnectionArgSortPlugin";
import { DynamicAttributesInflectionPlugin } from "./DynamicAttributesInflectionPlugin";

const PgDynamicAttributesPlugin: Plugin = (builder, options) => {
  DynamicAttributesInflectionPlugin(builder, options);
  AddSortNullsEnumPlugin(builder, options);
  ConnectionArgSortPlugin(builder, options);
};

export default PgDynamicAttributesPlugin;
