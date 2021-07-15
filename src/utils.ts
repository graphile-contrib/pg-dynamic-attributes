import type { Plugin, Build } from "graphile-build";
import {
  PgAttribute,
  PgClass,
  PgEntityKind,
  PgIntrospectionResultsByKind,
  SQL,
} from "graphile-build-pg";

interface ParseSpecResult {
  dynamicAttributeTable: PgClass;
  referencedAttributes: PgAttribute[];
  referencingAttributes: PgAttribute[];
  keyAttributes: PgAttribute[];
  valueColumn: PgAttribute;
}

function _parseSpec(build: Build, table: PgClass): ParseSpecResult | null {
  const { describePgEntity, pgIntrospectionResultsByKind } = build;
  const introspectionResultsByKind: PgIntrospectionResultsByKind =
    pgIntrospectionResultsByKind;
  const tag = table.tags.dynamicAttributes;
  if (tag == null) {
    return null;
  }

  if (typeof tag !== "string") {
    throw new Error(
      `Invalid smart tag value for 'dynamicAttribute' on ${describePgEntity(
        table,
      )}`,
    );
  }

  const tablePk = table.primaryKeyConstraint;
  if (!tablePk) {
    throw new Error(
      `Invalid smart tag value for 'dynamicAttribute' on ${describePgEntity(
        table,
      )}; ${table.name} needs a primary key`,
    );
  }

  if (tablePk.keyAttributes.length > 1) {
    throw new Error(
      `Invalid smart tag value for 'dynamicAttribute' on ${describePgEntity(
        table,
      )}; ${table.name} must have a single column primary key`,
    );
  }

  const tablePkColumn = tablePk.keyAttributes[0];

  const parts = tag.split(" ");
  if (parts.length > 2) {
    throw new Error(
      `Invalid smart tag value for 'dynamicAttribute' on ${describePgEntity(
        table,
      )}; expected one or two values, but received '${tag}'`,
    );
  }

  const [tableSpec, columnSpec] = parts;

  const tableSpecParts = tableSpec
    .split(".")
    .map((str) => str.replace(/^"|"$/g, ""));
  if (tableSpecParts.length > 2) {
    throw new Error(
      `Invalid smart tag value for 'dynamicAttribute' on ${describePgEntity(
        table,
      )}; table specification has too many periods - expected 'schema.table' but received '${tableSpec}'`,
    );
  }

  const dynamicAttributeTable = introspectionResultsByKind.class.find((tbl) => {
    if (tableSpecParts.length === 2) {
      return (
        tbl.namespaceName === tableSpecParts[0] &&
        tbl.name === tableSpecParts[1]
      );
    } else {
      return tbl.name === tableSpecParts[0];
    }
  });
  if (!dynamicAttributeTable) {
    throw new Error(
      `Invalid smart tag value for 'dynamicAttribute' on ${describePgEntity(
        table,
      )}; table specification could not be satisified - could not find table '${tableSpec}'`,
    );
  }

  const columnName = columnSpec.replace(/^"|"$/g, "");
  const valueColumn = dynamicAttributeTable.attributes.find(
    (attr) => attr.name === columnName,
  );
  if (!valueColumn) {
    throw new Error(
      `Invalid smart tag value for 'dynamicAttribute' on ${describePgEntity(
        table,
      )}; table specification could not be satisified - could not find column '${columnName}' on table ${describePgEntity(
        dynamicAttributeTable,
      )}`,
    );
  }

  // We could allow the use of a different constraint, we're just using the
  // primary key for simplicity currently.
  const pk = dynamicAttributeTable.primaryKeyConstraint;
  if (!pk) {
    throw new Error(
      `Invalid smart tag value for 'dynamicAttribute' on ${describePgEntity(
        table,
      )}; ${describePgEntity(
        dynamicAttributeTable,
      )} does not have a primary key`,
    );
  }

  const pkAttributes = pk.keyAttributes;
  if (pkAttributes.length < 2) {
    throw new Error(
      `Invalid smart tag value for 'dynamicAttribute' on ${describePgEntity(
        table,
      )}; ${describePgEntity(
        dynamicAttributeTable,
      )} has only one column in its primary key`,
    );
  }

  if (pkAttributes[0].type !== tablePkColumn.type) {
    throw new Error(
      `Invalid smart tag value for 'dynamicAttribute' on ${describePgEntity(
        table,
      )}; the first entry in ${describePgEntity(
        dynamicAttributeTable,
      )}'s primary key must be a reference to ${table.name}`,
    );
  }

  const referencedAttributes = [tablePkColumn];
  const referencingAttributes = pkAttributes.slice(0, 1);
  const keyAttributes = pkAttributes.slice(1);

  return {
    dynamicAttributeTable,
    referencedAttributes,
    referencingAttributes,
    keyAttributes,
    valueColumn,
  };
}

const parseSpecCache = new WeakMap<
  Build,
  Map<PgClass, ParseSpecResult | null>
>();
// Memoized _parseSpec
export function parseSpec(
  build: Build,
  table: PgClass,
): ParseSpecResult | null {
  if (table.kind !== PgEntityKind.CLASS) {
    console.error("parseSpec called with non-table");
    return null;
  }
  let cacheByClass = parseSpecCache.get(build);
  if (!cacheByClass) {
    cacheByClass = new Map();
    parseSpecCache.set(build, cacheByClass);
  }
  let cachedResult = cacheByClass.get(table);
  if (cachedResult === undefined) {
    cachedResult = _parseSpec(build, table);
    cacheByClass.set(table, cachedResult);
  }
  return cachedResult;
}

export function subquery(
  build: Build,
  spec: ParseSpecResult,
  alias: SQL,
  value: { [key: string]: any },
) {
  const { pgSql: sql, gql2pg, inflection } = build;
  const {
    valueColumn,
    referencedAttributes,
    referencingAttributes,
    keyAttributes,
    dynamicAttributeTable,
  } = spec;
  const conditions: SQL = [];
  referencedAttributes.forEach((attr, i) => {
    conditions.push(
      sql.fragment`${alias}.${sql.identifier(attr.name)} = da.${sql.identifier(
        referencingAttributes[i].name,
      )}`,
    );
  });
  keyAttributes.forEach((attr) => {
    conditions.push(
      sql.fragment`da.${sql.identifier(attr.name)} = ${gql2pg(
        value[inflection.column(attr)],
        attr.type,
        attr.typeModifier,
      )}`,
    );
  });

  const where = sql.fragment`(${sql.join(conditions, ") and (")})`;

  return sql.fragment`(select da.${sql.identifier(
    valueColumn.name,
  )} from ${sql.identifier(
    dynamicAttributeTable.namespaceName,
    dynamicAttributeTable.name,
  )} as da where ${where})`;
}
