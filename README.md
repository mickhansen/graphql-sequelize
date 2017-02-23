# graphql-sequelize

[![NPM](https://img.shields.io/npm/v/graphql-sequelize.svg)](https://www.npmjs.com/package/graphql-sequelize)
[![Build Status](https://travis-ci.org/mickhansen/graphql-sequelize.svg?branch=master)](https://travis-ci.org/mickhansen/graphql-sequelize)
[![Slack](http://sequelize-slack.herokuapp.com/badge.svg)](http://sequelize-slack.herokuapp.com)
[![Coverage](https://codecov.io/gh/mickhansen/graphql-sequelize/branch/master/graph/badge.svg)](https://codecov.io/gh/mickhansen/graphql-sequelize)

- [Installation](#installation)
- [Resolve helpers](#resolve-helpers)
- [field helpers](#field-helpers)
- [args helpers](#args-helpers)

## Installation

`$ npm install --save graphql-sequelize`

graphql-sequelize assumes you have graphql and sequelize installed.

## Resolve helpers

A helper for resolving graphql queries targeted at Sequelize models or associations.
Please take a look at [the tests](https://github.com/mickhansen/graphql-sequelize/blob/master/test/integration/resolver.test.js) to best get an idea of implementation.

### Features

- Automatically converts args to where if arg keys matches model attributes
- Automatically converts an arg named 'limit' to a sequelize limit
- Automatically converts an arg named 'order' to a sequelize order
- Only loads the attributes defined in the query (automatically adds primary key and foreign keys)
- Batching of nested associations (see [dataloader-sequelize](https://github.com/mickhansen/dataloader-sequelize))

### Relay & Connections

[Relay documentation](docs/relay.md)

### Examples

```js
import {resolver} from 'graphql-sequelize';

let User = sequelize.define('user', {
  name: Sequelize.STRING
});

let Task = sequelize.define('task', {
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
      type: new GraphQLList(taskType),
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

attributeFields(Model, {
  // ... options
  exclude: Array, // array of model attributes to ignore - default: []
  only: Array, // only generate definitions for these model attributes - default: null
  globalId: Boolean, // return an relay global id field - default: false
  map: Object, // rename fields - default: {}
  allowNull: Boolean, // disable wrapping mandatory fields in `GraphQLNonNull` - default: false
  commentToDescription: Boolean, // convert model comment to GraphQL description - default: false
  cache: Object, // Cache enum types to prevent duplicate type name error - default: {}
});

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
### Providing custom types

`attributeFields` uses the graphql-sequelize `typeMapper` to map Sequelize types to GraphQL types. You can supply your own
mapping function to override this behavior using the `mapType` export.

```js
var Model = sequelize.define('User', {
  email: {
    type: Sequelize.STRING,
    allowNull: false
  },
  isValid: {
    type: Sequelize.BOOLEAN,
    allowNull: false
  }
});

import {attributeFields,typeMapper} from 'graphql-sequelize';
typeMapper.mapType((type) => {
   //map bools as strings
   if (type instanceof Sequelize.BOOLEAN) {
     return GraphQLString
   }
   //use default for everything else
   return false
});

//map fields
attributeFields(Model);

/*
{
  id: {
    type: new GraphQLNonNull(GraphQLInt)
  },
  email: {
    type: new GraphQLNonNull(GraphQLString)
  },
  isValid: {
      type: new GraphQLNonNull(GraphQLString)
  },
}
*/

```

### Renaming generated fields

attributeFields accepts a ```map``` option to customize the way the attribute fields are named. The ```map``` option accepts
an object or a function that returns a string.

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

attributeFields(Model, {
    map:{
        email:"Email",
        firstName:"FirstName",
        lastName:"LastName"
    }
});

/*
{
  id: {
    type: new GraphQLNonNull(GraphQLInt)
  },
  Email: {
    type: new GraphQLNonNull(GraphQLString)
  },
  FirstName: {
    type: GraphQLString
  },
  LastName: {
    type: GraphQLString
  }
}
*/

attributeFields(Model, {
    map:(k) => k.toLowerCase()
});

/*
{
  id: {
    type: new GraphQLNonNull(GraphQLInt)
  },
  email: {
    type: new GraphQLNonNull(GraphQLString)
  },
  firstname: {
    type: GraphQLString
  },
  lastname: {
    type: GraphQLString
  }
}
*/

```

### ENUM attributes with non-alphanumeric characters

GraphQL enum types [only support ASCII alphanumeric characters and underscores](https://facebook.github.io/graphql/#Name).
If you have other characters, like a dash (`-`) in your Sequelize enum types,
they will be converted to camelCase. For example: `foo-bar` becomes `fooBar`.

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

`defaultArgs(Model)` will return an object containing an arg with a key and type matching your models primary key and
the "where" argument for passing complex query operations described [here](http://docs.sequelizejs.com/en/latest/docs/querying/)

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
    type: GraphQLString
  },
  where: {
    type: JSONType
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
  },
  where: {
    type: JSONType
  }
}
```

Which when added to args will let the resolver automatically support limit and ordering in args for graphql queries.
Should be used with fields of type `GraphQLList`.

```js
import {defaultListArgs} from 'graphql-sequelize'

args: _.assign(defaultListArgs(), {
  // ... additional args
})
```
