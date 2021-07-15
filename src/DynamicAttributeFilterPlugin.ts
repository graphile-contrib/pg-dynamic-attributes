import type { Plugin } from "graphile-build";
import type { ConnectionFilterResolver } from "postgraphile-plugin-connection-filter/dist/PgConnectionArgFilterPlugin";
import { parseSpec, subquery } from "./utils";

export const DynamicAttributeFilterPlugin: Plugin = (builder) => {
  builder.hook("GraphQLInputObjectType:fields", (fields, build, context) => {
    const {
      extend,
      newWithHooks,
      inflection,
      connectionFilterOperatorsType,
      connectionFilterRegisterResolver,
      connectionFilterResolve,
      connectionFilterTypesByTypeName,
      getTypeByName,
      graphql: { GraphQLInputObjectType, GraphQLNonNull },
    } = build;
    const {
      fieldWithHooks,
      scope: { pgIntrospection: table, isPgConnectionFilter },
      Self,
    } = context;

    if (!isPgConnectionFilter || table.kind !== "class") return fields;

    connectionFilterTypesByTypeName[Self.name] = Self;

    const spec = parseSpec(build, table);
    if (!spec) {
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

    const OperatorsType = connectionFilterOperatorsType(
      newWithHooks,
      valueColumn.typeId,
      valueColumn.typeModifier,
    );

    const resolve: ConnectionFilterResolver = ({
      sourceAlias,
      fieldName,
      fieldValue,
      queryBuilder,
    }) => {
      if (fieldValue == null) return null;

      const { match, filter } = fieldValue as any;
      const fragment = subquery(build, spec, sourceAlias, match);
      const pgType = valueColumn.type;
      const pgTypeModifier = valueColumn.typeModifier;
      const filterTypeName = OperatorsType.name;

      return connectionFilterResolve(
        filter,
        fragment,
        filterTypeName,
        queryBuilder,
        pgType,
        pgTypeModifier,
        fieldName,
      );
    };

    connectionFilterRegisterResolver(Self.name, fieldName, resolve);

    const typeName = inflection.dynamicAttributeFilterType(table);
    const TableDynamicAttributeFilter =
      getTypeByName(typeName) ||
      newWithHooks(
        GraphQLInputObjectType,
        {
          name: typeName,
          fields: {
            match: {
              type: new GraphQLNonNull(TableDynamicAttribute),
            },
            filter: {
              type: new GraphQLNonNull(OperatorsType),
            },
          },
        },
        {
          isPgDynamicAttributeFilter: true,
          pgIntrospection: table,
        },
      );

    return extend(
      fields,
      {
        [fieldName]: fieldWithHooks(
          fieldName,
          {
            description: `Filter by a dynamic field.`,
            type: TableDynamicAttributeFilter,
          },
          {
            isPgConnectionFilterField: true,
            pgIntrospection: table,
          },
        ),
      },
      `Adding '${fieldName}' to '${Self.name}'`,
    );
  });
};
