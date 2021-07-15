import type { Plugin } from "graphile-build";
import { AddSortNullsEnumPlugin } from "./AddSortNullsEnumPlugin";
import { ConnectionArgSortPlugin } from "./ConnectionArgSortPlugin";
import { DynamicAttributeFieldPlugin } from "./DynamicAttributeFieldPlugin";
import { DynamicAttributeFilterPlugin } from "./DynamicAttributeFilterPlugin";
import { DynamicAttributesInflectionPlugin } from "./DynamicAttributesInflectionPlugin";
import { DynamicAttributeSortPlugin } from "./DynamicAttributeSortPlugin";
import { TableDynamicAttributePlugin } from "./TableDynamicAttributePlugin";

const PgDynamicAttributesPlugin: Plugin = (builder, options) => {
  DynamicAttributesInflectionPlugin(builder, options);
  AddSortNullsEnumPlugin(builder, options);
  TableDynamicAttributePlugin(builder, options);
  ConnectionArgSortPlugin(builder, options);
  DynamicAttributeSortPlugin(builder, options);
  DynamicAttributeFieldPlugin(builder, options);
  DynamicAttributeFilterPlugin(builder, options);
};

export default PgDynamicAttributesPlugin;
