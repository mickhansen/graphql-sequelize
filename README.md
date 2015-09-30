# graphql-sequelize

- [Installation](#installation)
- [Resolve helpers](#resolve-helpers)
- [field helpers](#field-helpers)
- [args helpers](#args-helpers)

## Installation

`$ npm install --save graphql-sequelize`

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
import {resolver} from 'graphql-sequelize';

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
      resolve: resolver(User.Tasks, {
        separate: true // load seperately, disables auto including - default: false
      })
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
        resolve: resolver(User, {
          include: false // disable auto including of associations based on AST - default: true
        })
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

## field helpers

field helpers help you automatically define a models attributes as fields for a GraphQL object type.

```js
var Model = sequelize.define('User', {
  email: {
    type: Sequelize.STRING,
    allowNull: false
  },
  firstName: {
    type: Sequelize.STRING
  },
  lastName: {
    type: Sequelize.STRING
  }
});

import {attributeFields} from 'graphql-sequelize';

attributeFields(Model);

/*
{
  id: {
    type: new GraphQLNonNull(GraphQLInt)
  },
  email: {
    type: new GraphQLNonNull(GraphQLString)
  },
  firstName: {
    type: GraphQLString
  },
  lastName: {
    type: GraphQLString
  }
}
*/

userType = new GraphQLObjectType({
  name: 'User',
  description: 'A user',
  fields: _.assign(attributeFields(Model), {
    // ... extra fields
  })
});
```

### VIRTUAL attributes and GraphQL fields

If you have `Sequelize.VIRTUAL` attributes on your sequelize model, you need to explicitly set the return type and any field dependencies via `new Sequelize.VIRTUAL(returnType, [dependencies ... ])`.

For example, `fullName` here will not always return valid data when queried via GraphQL:
```js
firstName: { type: Sequelize.STRING },
lastName: { type: Sequelize.STRING },
fullName: {
  type: Sequelize.VIRTUAL,
  get: function() { return `${this.firstName} ${this.lastName}`; },
},
```

To work properly `fullName` needs to be more fully specified:

```js
firstName: { type: Sequelize.STRING },
lastName: { type: Sequelize.STRING },
fullName: {
  type: new Sequelize.VIRTUAL(Sequelize.STRING, ['firstName', 'lastName']),
  get: function() { return `${this.firstName} ${this.lastName}`; },
},
```

## args helpers

### defaultArgs

`defaultArgs(Model)` will return an object containing an arg with a key and type matching your models primary key.

```js
var Model = sequelize.define('User', {
  
});

defaultArgs(Model);

/*
{
  id: {
    type: new GraphQLNonNull(GraphQLInt)
  }
}
*/

var Model = sequelize.define('Project', {
  project_id: {
    type: Sequelize.UUID
  }
});

defaultArgs(Model);

/*
{
  project_id: {
    type: new GraphQLNonNull(GraphQLString)
  }
}
*/
```

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
Should be be used with fields of type `GraphQLList`

```js
import {defaultListArgs} from 'graphql-sequelize'

args: {
  _.assign(defaultListArgs(), {
    // ... additional args
  })
}
```
