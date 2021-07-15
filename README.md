# @graphile-contrib/pg-dynamic-attributes

This plugin enhances a PostGraphile schema with the ability to order by and
filter by "dynamic attributes." For the purpose of this plugin "dynamic
attributes" are stored into records in a related table and aren't known at
schema build time.

Example database schema:

```sql
create table objects (
  id serial primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table object_properties (
  object_id int not null references objects on delete cascade,
  attribute text not null,
  value text not null,
  primary key (object_id, attribute)
);

comment on table objects is E'@dynamicAttributes object_properties value';
```

This will add the `Object.dynamicAttribute` field to your GraphQL schema for
fetching a dynamic attribute:

```graphql
type Object {
  # ...

  """
  Fetches the dynamic attribute given the value of `attribute` for this
  `Object`.
  """
  dynamicAttribute(match: ObjectDynamicAttribute): String
}
```

It will also add a `sort` argument to related connections so that you can order
by these attributes:

```graphql
"""
When the given sortable is null, should we position this at the end of the list
or the beginning of the list?
"""
enum SortNulls {
  """
  Order nulls last when in ascending order, or first when in descending order.
  """
  DEFAULT

  """
  Order nulls first (at the beginning of the list).
  """
  FIRST

  """
  Order nulls last (at the end of the list).
  """
  LAST
}

"""
Sortable concrete fields for the `Object` type.
"""
enum ObjectSortableField {
  ID
  NAME
  CREATED_AT
}

"""
Dynamic attribute keys for the `Object` type.
"""
input ObjectDynamicAttribute {
  attribute: String!
}

"""
The specifier of what we should sort by.  Exactly one of these values must be
specified and non-null (this will use `@oneOf`
[when that feature is merged into GraphQL](https://github.com/graphql/graphql-spec/pull/825)).
"""
input ObjectSortBy {
  field: ObjectSortableField
  dynamicAttribute: ObjectDynamicAttribute
}

"""
Specifies a sort for the `Object` type - what should we sort by, should it be
ascending or descending, and how should we handle nulls?
"""
input ObjectSort {
  sortBy: ObjectSortBy!
  ascending: Boolean! = true
  nulls: SortNulls! = DEFAULT
}

type Query {
  # ...
  allObjects(
    # ...
    sort: [ObjectSort!]
  ): ObjectsConnection
}
```

If you are using
[postgraphile-plugin-connection-filter](https://github.com/graphile-contrib/postgraphile-plugin-connection-filter)
then we'll also add filters to this plugin under the `dynamicAttribute` key:

```graphql
{
  allObjects(
    filter: {
      and: [
        {
          dynamicAttribute: {
            match: {
              attribute: "Attribute1"
            }
            filter: {
              equalTo: "Value1"
            }
          }
        },
        {
          dynamicAttribute: {
            match: {
              attribute: "Attribute2"
            }
            filter: {
              equalTo: "Value2"
            }
          }
        }
      ]
    }
  ) {
    # ...
  }
}
```

## Crowd-funded open-source software

We rely on the community's support to keep producing and maintaining OSS; if you
find this plugin helpful, please
[click here to find out more about sponsors and sponsorship.](https://www.graphile.org/sponsor/)

## Usage

From the CLI you can install this plugin and run using command line
`postgraphile`:

```
yarn add postgraphile @graphile-contrib/pg-dynamic-attributes
yarn postgraphile --append-plugins @graphile-contrib/pg-dynamic-attributes -c postgres://localhost/my_db
```

In library mode you can use `appendPlugins` to install the plugin:

```js
app.use(
  postgraphile(process.env.DATABASE_URL, process.env.SCHEMA_NAME, {
    appendPlugins: [require("@graphile-contrib/pg-dynamic-attributes")],
  }),
);
```

## Status

Experimental; the API may yet change.

## Thanks 🙏

This plugin was originally sponsored by
[Pixel Networks](https://pixel-networks.com/) 🙌
