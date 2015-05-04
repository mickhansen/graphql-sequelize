# graphql-sequelize
GraphQL queries with Sequelize.

This is mostly a toy trying to implement the ideas of GraphQL with Sequelize.
No attempts will be made to support writes, hopefully we can provide a full implementation when relay/graphql is released.

Does not support `viewer()`, only node lookups with specific ids.
Does not support ordering.

Should be used with [ssacl](https://github.com/pumpupapp/ssacl) for just a minimal layer of safety.

## Usage
```js
var query = require('graphsql-sequelize')(sequelize);

return query(graphql`
  post(2) {
    title,
    category,
    author {
      firstName,
      lastName
    },
    comments {
      content,
      author {
        firstName,
        lastName
      }
  }
`);
```

## Goals

- Support GraphQL spec
- Support a relay frontend
- Support writes
- Support viewer()
- Support ordering
