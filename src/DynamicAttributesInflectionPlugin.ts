import type { PgAttribute, PgClass } from "graphile-build-pg";
import type { Plugin } from "graphile-build";

export const DynamicAttributesInflectionPlugin: Plugin = (builder) => {
  builder.hook("inflection", (inflection, build) => {
    return build.extend(
      inflection,
      {
        sortableField(attr: PgAttribute) {
          return this.constantCase(attr.name);
        },
        sortableFieldType(table: PgClass) {
          return this.upperCamelCase(
            `${this._tableName(table)}-sortable-field`,
          );
        },
        sortByType(table: PgClass) {
          return this.upperCamelCase(`${this._tableName(table)}-sort-by`);
        },
        sortType(table: PgClass) {
          return this.upperCamelCase(`${this._tableName(table)}-sort`);
        },
      },
      "Adding pg-dynamic-attributes inflectors",
    );
  });
};
