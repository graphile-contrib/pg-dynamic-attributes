import type { Build, Plugin } from "graphile-build";
import type {
  PgIntrospectionResultsByKind,
  QueryBuilder,
  SQL,
} from "graphile-build-pg";
import type {
  GraphQLEnumType,
  GraphQLFieldMap,
  GraphQLInputFieldMap,
  GraphQLInputObjectType,
  GraphQLObjectType,
} from "graphql";

// Based heavily on the original order plugin:
// https://github.com/graphile/graphile-engine/blob/726c210ae6f559c132f859fed18dc031a2a2cb1c/packages/graphile-build-pg/src/plugins/PgConnectionArgOrderBy.js

interface SortableField {
  attrName: string;
  unique: boolean;
}

// TODO: rename
export interface SortBy {
  field: SortableField;
}

export interface SortSpec {
  specs: Array<string | SQL>;
  cursorPrefix: string;
  unique?: boolean;
}

// TODO: rename
interface Sort {
  sortBy: SortBy;
  ascending: boolean;
  nulls: "DEFAULT" | "FIRST" | "LAST";
}

// Emulation of @oneOf validation + access
function getSortBy(
  build: Build,
  sortBy: SortBy,
  TableSortByTypeFields: GraphQLInputFieldMap,
): SortSpec {
  const keys = Object.keys(sortBy) as Array<keyof SortBy>;
  if (keys.length !== 1) {
    throw new Error("You must specify exactly one sortBy value");
  }
  const key = keys[0];
  const value = sortBy[key];
  if (value == null) {
    throw new Error("The sortBy value you specify cannot be null");
  }
  const {
    graphql: { getNamedType },
  } = build;
  const type = getNamedType(TableSortByTypeFields[key].type);
  if (!("extensions" in type) || !type.extensions?.sortSpec) {
    throw new Error(`Schema error: ${type} does not specify a sortSpec`);
  }

  const { specs, cursorPrefix, unique } = type.extensions.sortSpec(value);
  if (!specs) {
    throw new Error(
      `Invalid value returned from ${type.name}.extensions.sortSpec: specs was not provided.`,
    );
  }
  if (!Array.isArray(specs)) {
    throw new Error(
      `Invalid value returned from ${type.name}.extensions.sortSpec: specs should be an array.`,
    );
  }
  if (
    !specs.every((spec) => {
      return typeof spec === "string" || !!spec;
    })
  ) {
    throw new Error(
      `Invalid value returned from ${
        type.name
      }.extensions.sortSpec: the specs do not conform, received: ${JSON.stringify(
        specs,
      )}`,
    );
  }
  if (typeof cursorPrefix !== "string") {
    throw new Error(
      `Invalid value returned from ${type.name}.extensions.sortSpec: the cursorPrefix is not a string`,
    );
  }
  if (typeof unique !== "string" && unique != null) {
    throw new Error(
      `Invalid value returned from ${type.name}.extensions.sortSpec: unique has invalid value`,
    );
  }
  return { specs, cursorPrefix, unique };
}

export const ConnectionArgSortPlugin: Plugin = (builder) => {
  builder.hook("init", (_, build, context) => {
    const {
      newWithHooks,
      pgIntrospectionResultsByKind,
      graphql: {
        GraphQLEnumType,
        GraphQLInputObjectType,
        GraphQLNonNull,
        GraphQLBoolean,
      },
      inflection,
      pgOmit: omit,
      sqlCommentByAddingTags,
      describePgEntity,
      addType,
      pgColumnFilter,
      extend,
    } = build;
    const introspectionResultsByKind: PgIntrospectionResultsByKind =
      pgIntrospectionResultsByKind;
    introspectionResultsByKind.class.forEach((table) => {
      if (!table.isSelectable || omit(table, "order")) return;
      if (!table.namespace) return;

      const tableTypeName = inflection.tableType(table);
      const TableSortableField = newWithHooks(
        GraphQLEnumType,
        {
          name: inflection.sortableFieldType(table),
          description: build.wrapDescription(
            `Sortable concrete fields for the \`${tableTypeName}\` type.`,
            "type",
          ),
          values: table.attributes.reduce((memo, attr) => {
            if (!pgColumnFilter(attr, build, context)) return memo;
            if (omit(attr, "order")) return memo;
            const unique = attr.isUnique;
            memo = extend(
              memo,
              {
                [inflection.sortableField(attr)]: {
                  value: {
                    attrName: attr.name,
                    unique,
                  } as SortableField,
                },
              },
              `Adding sort field enum value for ${describePgEntity(
                attr,
              )}. You can rename this field with a 'Smart Comment':\n\n  ${sqlCommentByAddingTags(
                attr,
                {
                  name: "newNameHere",
                },
              )}`,
            );
            return memo;
          }, {}),
          extensions: {
            sortSpec(value: SortableField): SortSpec {
              if (
                typeof value !== "object" ||
                !value ||
                typeof value.attrName !== "string"
              ) {
                throw new Error(
                  `sortSpec called with invalid value ${JSON.stringify(value)}`,
                );
              }
              return {
                specs: [value.attrName],
                cursorPrefix: value.attrName,
                unique: value.unique,
              };
            },
          },
        },
        {
          __origin: `Adding sortable fields type for ${describePgEntity(
            table,
          )}. You can rename the table's GraphQL type via a 'Smart Comment':\n\n  ${sqlCommentByAddingTags(
            table,
            {
              name: "newNameHere",
            },
          )}`,
          pgIntrospection: table,
          isPgSortableFieldEnum: true,
        },
      );
      addType(TableSortableField);

      const TableSortBy = newWithHooks(
        GraphQLInputObjectType,
        {
          name: inflection.sortByType(table),
          description:
            "The specifier of what we should sort by.  Exactly one of these values must be specified and non-null (this will use `@oneOf` [when that feature is merged into GraphQL](https://github.com/graphql/graphql-spec/pull/825)).",
          fields: {
            field: {
              type: TableSortableField,
            },
          },
        },
        {
          pgIntrospection: table,
          isPgSortByInput: true,
        },
      );
      addType(TableSortBy);

      const SortNulls: GraphQLEnumType = build.getTypeByName(
        inflection.builtin("SortNulls"),
      );
      const TableSort = newWithHooks(
        GraphQLInputObjectType,
        {
          name: inflection.sortType(table),
          description:
            "Specifies a sort for the `Object` type - what should we sort by, should it be ascending or descending, and how should we handle nulls?",
          fields: {
            sortBy: {
              type: new GraphQLNonNull(TableSortBy),
            },
            ascending: {
              type: new GraphQLNonNull(GraphQLBoolean),
              defaultValue: true,
            },
            nulls: {
              type: new GraphQLNonNull(SortNulls),
              defaultValue: SortNulls.getValues()[0].value,
            },
          },
        },
        {
          pgIntrospection: table,
          isPgSortInput: true,
        },
      );
      addType(TableSort);
    });
    return _;
  });

  builder.hook(
    "GraphQLObjectType:fields:field:args",
    (args, build, context) => {
      const {
        extend,
        getTypeByName,
        pgGetGqlTypeByTypeIdAndModifier,
        pgSql: sql,
        graphql: { GraphQLList, GraphQLNonNull },
        inflection,
        pgOmit: omit,
      } = build;
      const {
        scope: {
          fieldName,
          isPgFieldConnection,
          isPgFieldSimpleCollection,
          pgFieldIntrospection,
          pgFieldIntrospectionTable,
        },
        addArgDataGenerator,
        Self,
      } = context;

      if (!isPgFieldConnection && !isPgFieldSimpleCollection) {
        return args;
      }

      const proc =
        pgFieldIntrospection.kind === "procedure" ? pgFieldIntrospection : null;
      const table =
        pgFieldIntrospection.kind === "class"
          ? pgFieldIntrospection
          : proc
          ? pgFieldIntrospectionTable
          : null;
      if (
        !table ||
        !table.namespace ||
        !table.isSelectable ||
        omit(table, "order")
      ) {
        return args;
      }
      if (proc) {
        if (!proc.tags.sortable) {
          return args;
        }
      }
      const TableType: GraphQLObjectType = pgGetGqlTypeByTypeIdAndModifier(
        table.type.id,
        null,
      );
      const tableTypeName = TableType.name;
      const TableSortType: GraphQLInputObjectType = getTypeByName(
        inflection.sortType(table),
      );
      const TableSortByType: GraphQLInputObjectType = getTypeByName(
        inflection.sortByType(table),
      );
      const TableSortByTypeFields = TableSortByType.getFields();
      if (!TableSortByType || !TableSortType) {
        return args;
      }

      addArgDataGenerator(function connectionOrderBy({
        sort: rawSort,
      }: {
        sort: Sort[] | Sort;
      }) {
        const sort = rawSort
          ? Array.isArray(rawSort)
            ? rawSort
            : [rawSort]
          : null;
        if (!sort || sort.length === 0) {
          return;
        }
        try {
          const sortResult = sort.map((item) => {
            const { sortBy, ascending, nulls } = item;
            const { specs, cursorPrefix, unique } = getSortBy(
              build,
              sortBy,
              TableSortByTypeFields,
            );
            return {
              ascending,
              nulls,
              specs,
              cursorPrefix,
              unique,
            };
          });
          return {
            pgCursorPrefix: sortResult.map((r) => r.cursorPrefix),
            pgQuery: (queryBuilder: QueryBuilder) => {
              sortResult.forEach((r) => {
                const { ascending, nulls, specs, unique } = r;
                specs.forEach((spec) => {
                  const expr =
                    typeof spec === "string"
                      ? sql.fragment`${queryBuilder.getTableAlias()}.${sql.identifier(
                          spec,
                        )}`
                      : spec;
                  // If the enum specifies null ordering, use that
                  // Otherwise, use the orderByNullsLast option if present
                  const nullsFirst =
                    nulls === "FIRST"
                      ? true
                      : nulls === "LAST"
                      ? false
                      : undefined;
                  console.log({ expr, ascending, nullsFirst });
                  queryBuilder.orderBy(expr, ascending, nullsFirst);
                });
                if (unique) {
                  queryBuilder.setOrderIsUnique();
                }
              });
            },
          };
        } catch (e) {
          console.error(e);
          throw new Error("Failed to build this sort; internal error.");
        }
      });

      return extend(
        args,
        {
          sort: {
            description: build.wrapDescription(
              `The specification of how the \`${tableTypeName}\` records should be sorted.`,
              "arg",
            ),
            type: new GraphQLList(new GraphQLNonNull(TableSortType)),
          },
        },
        `Adding 'sort' argument to field '${fieldName}' of '${Self.name}'`,
      );
    },
  );
};
