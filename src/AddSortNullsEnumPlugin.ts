import type { Plugin } from "graphile-build";

export const AddSortNullsEnumPlugin: Plugin = (builder) => {
  builder.hook("init", function AddSortNullsEnum(_, build, _context) {
    const {
      newWithHooks,
      graphql: { GraphQLEnumType },
      inflection,
      addType,
    } = build;
    const SortNulls = newWithHooks(
      GraphQLEnumType,
      {
        name: inflection.builtin("SortNulls"),
        description:
          "When the given sortable is null, should we position this at the end of the list or the beginning of the list?",
        values: {
          DEFAULT: {
            value: "DEFAULT",
            description:
              "Order nulls last when in ascending order, or first when in descending order.",
          },
          FIRST: {
            value: "FIRST",
            description: "Order nulls first (at the beginning of the list).",
          },
          LAST: {
            value: "LAST",
            description: "Order nulls last (at the end of the list).",
          },
        },
      },
      {
        isSortNullsEnum: true,
      },
    );
    addType(SortNulls);
    return _;
  });
};
