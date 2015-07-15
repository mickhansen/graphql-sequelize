# graphql-sequelize

- [Installation](#installation)
- [Resolve helpers](#resolve-helpers)
- [args helpers](#args-helpers)

## Installation

`$ npm install --save-dev graphql-sequelize`

graphql-sequelize assumes you have graphql and sequelize installed.

## Resolve helpers

A helper for resolving graphql queries targeted at Sequelize models or associations.
Please take a look at [the tests](https://github.com/mickhansen/graphql-sequelize/blob/master/test/resolver.test.js) to best get an idea of implementation.

### Features

- Automatically converts args to where if arg keys matches model attributes
- Automatically converts a arg named 'limit' to a sequelize limit
- Automatically converts a arg named 'order' to a sequelize order
- Only loads the attributes defined in the query (automatically adds primary key and foreign keys)
- Prefetching nested resolvers with includes/joins

### Examples 

```js
import resolver from 'graphql-sequelize';

let User = sequelize.define('user', {
  name: Sequelize.STRING
});

let Task = sequelize.define('user', {
  title: Sequelize.STRING
});

User.Tasks = User.hasMany(Task, {as: 'tasks'});

let taskType = new GraphQLObjectType({
  name: 'Task',
  description: 'A task',
  fields: {
    id: {
      type: new GraphQLNonNull(GraphQLInt),
      description: 'The id of the task.',
    },
    title: {
      type: GraphQLString,
      description: 'The title of the task.',
    }
  }
});

let userType = new GraphQLObjectType({
  name: 'User',
  description: 'A user',
  fields: {
    id: {
      type: new GraphQLNonNull(GraphQLInt),
      description: 'The id of the user.',
    },
    name: {
      type: GraphQLString,
      description: 'The name of the user.',
    },
    tasks: {
      type: GraphQLList(taskType),
      resolve: resolver(User.Tasks)
    }
  }
});

let schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'RootQueryType',
    fields: {
      user: {
        type: userType,
        // args will automatically be mapped to `where`
        args: {
          id: {
            description: 'id of the user',
            type: new GraphQLNonNull(GraphQLInt)
          }
        },
        resolve: resolver(User)
      }
    }
  })
});

let schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'RootQueryType',
    fields: {
      users: {
        // The resolver will use `findOne` or `findAll` depending on whether the field it's used in is a `GraphQLList` or not.
        type: new GraphQLList(userType),
        args: {
          // An arg with the key limit will automatically be converted to a limit on the target
          limit: {
            type: GraphQLInt
          },
          // An arg with the key order will automatically be converted to a order on the target
          order: {
            type: GraphQLString
          }
        },
        resolve: resolver(User)
      }
    }
  })
});
```

## args helpers

### defaultListArgs

`defaultListArgs` will return an object like:

```js
{
  limit: {
    type: GraphQLInt
  },
  order: {
    type: GraphQLString
  }
}
```

Which when added to args will let the resolver automatically support limit and ordering in args for graphql queries.

```js
import defaultListArgs from 'graphql-sequelize'

args: {
  _.assign(defaultListArgs(), {
    // ... additional args
  })
}
```
