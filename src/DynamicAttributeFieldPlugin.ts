import type { Plugin } from "graphile-build";
import type { QueryBuilder } from "graphile-build-pg";
import type { GraphQLFieldConfig } from "graphql";
import { parseSpec, subquery } from "./utils";

export const DynamicAttributeFieldPlugin: Plugin = (builder) => {
  builder.hook("GraphQLObjectType:fields", (fields, build, context) => {
    const {
      extend,
      inflection,
      getTypeByName,
      pgGetGqlTypeByTypeIdAndModifier,
      pgTweakFragmentForTypeAndModifier,
      pgSql: sql,
      graphql: { GraphQLString },
      getSafeAliasFromAlias,
      getSafeAliasFromResolveInfo,
      pg2gql,
    } = build;
    const {
      Self,
      scope: { isPgRowType, pgIntrospection: table },
      fieldWithHooks,
    } = context;
    if (!isPgRowType || !table || table.kind !== "class" || !table.namespace) {
      return fields;
    }
    const spec = parseSpec(build, table);
    if (!spec || table.kind !== "class" || !table.primaryKeyConstraint) {
      return fields;
    }
    const { valueColumn } = spec;
    const TableDynamicAttribute = getTypeByName(
      inflection.dynamicAttributeType(table),
    );
    if (!TableDynamicAttribute) {
      return fields;
    }
    const fieldName = inflection.dynamicAttribute();
    const ReturnType =
      pgGetGqlTypeByTypeIdAndModifier(
        valueColumn.typeId,
        valueColumn.typeModifier,
      ) || GraphQLString;
    return extend(
      fields,
      {
        [fieldName]: fieldWithHooks(
          fieldName,
          (fieldContext: any) => {
            const { addDataGenerator, getDataFromParsedResolveInfoFragment } =
              fieldContext;
            addDataGenerator((parsedResolveInfoFragment: any) => {
              const resolveData = getDataFromParsedResolveInfoFragment(
                parsedResolveInfoFragment,
                ReturnType,
              );
              return {
                pgQuery: (queryBuilder: QueryBuilder) => {
                  queryBuilder.select(
                    pgTweakFragmentForTypeAndModifier(
                      subquery(
                        build,
                        spec,
                        queryBuilder.getTableAlias(),
                        parsedResolveInfoFragment.args.match,
                      ),
                      valueColumn.type,
                      valueColumn.typeModifier,
                      resolveData,
                    ),
                    getSafeAliasFromAlias(parsedResolveInfoFragment.alias),
                  );
                },
              };
            });
            return {
              args: {
                match: {
                  type: TableDynamicAttribute,
                },
              },
              type: pgGetGqlTypeByTypeIdAndModifier(
                valueColumn.type.id,
                valueColumn.typeModifier,
              ),
              resolve(data, _args, _resolveContext, resolveInfo) {
                const safeAlias = getSafeAliasFromResolveInfo(resolveInfo);
                const value = data[safeAlias];
                return pg2gql(value, valueColumn.type);
              },
            } as GraphQLFieldConfig<any, any>;
          },
          { isDynamicAttributeField: true, pgIntrospection: table },
        ),
      },
      `Adding dynamicAttribute getter to ${Self.name}`,
    );
  });
};
