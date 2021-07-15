import type { Plugin } from "graphile-build";
import type { PgClass } from "graphile-build-pg";
import { parseSpec } from "./utils";

export const DynamicAttributeSortPlugin: Plugin = (builder) => {
  builder.hook("GraphQLInputObjectType:fields", (fields, build, context) => {
    const { extend, inflection, getTypeByName } = build;
    const {
      Self,
      scope: { isPgSortByInput, pgIntrospection },
    } = context;

    if (!isPgSortByInput) {
      return fields;
    }
    const table: PgClass = pgIntrospection;

    const spec = parseSpec(build, table);
    if (!spec || table.kind !== "class" || !table.primaryKeyConstraint) {
      return fields;
    }

    const TableDynamicAttribute = getTypeByName(
      inflection.dynamicAttributeType(table),
    );
    if (!TableDynamicAttribute) {
      return fields;
    }

    return extend(
      fields,
      {
        [inflection.dynamicAttribute()]: {
          type: TableDynamicAttribute,
        },
      },
      `Adding dynamicAttribute field to ${Self.name}`,
    );
  });
};
