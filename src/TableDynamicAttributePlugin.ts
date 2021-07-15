import type { GraphQLInputFieldConfigMap } from "graphql";
import { Plugin } from "graphile-build";
import { PgIntrospectionResultsByKind, SQL } from "graphile-build-pg";
import { parseSpec, subquery } from "./utils";
import { SortSpec } from "./ConnectionArgSortPlugin";

export const TableDynamicAttributePlugin: Plugin = (builder) => {
  builder.hook("init", (_, build, _context) => {
    const {
      pgIntrospectionResultsByKind,
      pgOmit: omit,
      newWithHooks,
      pgGetGqlInputTypeByTypeIdAndModifier,
      inflection,
      graphql: { GraphQLInputObjectType },
      pgSql: sql,
      gql2pg,
      addType,
    } = build;
    const introspectionResultsByKind: PgIntrospectionResultsByKind =
      pgIntrospectionResultsByKind;
    introspectionResultsByKind.class.forEach((table) => {
      if (!table.isSelectable || omit(table, "filter")) return;
      if (!table.namespace) return;
      const spec = parseSpec(build, table);
      if (!spec || table.kind !== "class" || !table.primaryKeyConstraint) {
        return;
      }
      const referencedAttributes = table.primaryKeyConstraint.keyAttributes;
      const TableDynamicAttribute = newWithHooks(
        GraphQLInputObjectType,
        {
          name: inflection.dynamicAttributeType(table),
          fields: spec.keyAttributes.reduce((memo, key) => {
            memo[inflection.column(key)] = {
              type: pgGetGqlInputTypeByTypeIdAndModifier(
                key.type.id,
                key.typeModifier,
              ),
            };
            return memo;
          }, {} as GraphQLInputFieldConfigMap),
          extensions: {
            sortSpec(value: { [key: string]: any }): SortSpec {
              return {
                specs: [
                  ({ queryBuilder }) => {
                    const alias = queryBuilder.getTableAlias();
                    return subquery(build, spec, alias, value);
                  },
                ],
                cursorPrefix: `dynamic|${JSON.stringify(value)}`,
                unique: false,
              };
            },
          },
        },
        { isPgDynamicAttributeInput: true, pgIntrospection: table },
      );
      addType(TableDynamicAttribute);
    });
    return _;
  });
};
