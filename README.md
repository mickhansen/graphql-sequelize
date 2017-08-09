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

```js
import { resolver } from "graphql-sequelize";

resolver(SequelizeModel[, options]);
```

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

### Options

The `resolver` function takes a model as its first (required) argument, but also
has a second options object argument. The available options are:

```js
resolver(SequelizeModel, {
  // Whether or not this should return a list. Defaults to whether or not the
  // field type is an instance of `GraphQLList`.
  list: false,

  // Whether or not relay connections should be handled. Defaults to `true`.
  handleConnection: true,

  /**
   * Manipulate the query before it's sent to Sequelize.
   * @param findOptions {object} - Options sent to Seqeulize model's find function
   * @param args {object} - The arguments from the incoming GraphQL query
   * @param context {object} - Resolver context, see more at GraphQL docs below.
   * @returns findOptions or promise that resolves with findOptions
   */
  before: (findOptions, args, context) => {
    findOptions.where = { /* Custom where arguments */ };
    return findOptions;
  },
  /**
   * Manipulate the Sequelize find results before it's sent back to the requester.
   * @param result {object|array} - Result of the query, object or array depending on list or not.
   * @param args {object} - The arguments from the incoming GraphQL query
   * @param context {object} - Resolver context, see more at GraphQL docs below.
   * @returns result(s) or promise that resolves with result(s)
   */
  after: (result, args, context) => {
    result.sort(/* Custom sort function */);
    return result;
  },
  /**
  * Only listed in allowedIncludes values are allowed to be used in "include" query argument.
  * Values could be strings or arrays of pairs of strings
  */
  allowedIncludes: ['model1', ['model2', 'model2PublicName'], 'model3']
});
```
For more details on allowedIncludes option read the ["Include"](#include-1) section

_The `args` and `context` parameters are provided by GraphQL. More information
about those is available in their [resolver docs](http://graphql.org/learn/execution/#root-fields-resolvers)._

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
      // Field for retrieving a user by ID
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
      },

      // Field for searching for a user by name
      userSearch: {
        type: new GraphQLList(userType),
        args: {
          query: {
            description: "Fuzzy-matched name of user",
            type: new GraphQLNonNull(GraphQLString),
          }
        },
        resolve: resolver(User, {
          // Custom `where` clause that fuzzy-matches user's name and
          // alphabetical sort by username
          before: (findOptions, args) => {
            findOptions.where = {
              name: { "$like": `%${args.query}%` },
            };
            findOptions.order = [['name', 'ASC']];
            return findOptions;
          },
          // Custom sort override for exact matches first
          after: (results, args) => {
            return results.sort((a, b) => {
              if (a.name === args.query) {
                return 1;
              }
              else if (b.name === args.query) {
                return -1;
              }

              return 0;
            });
          }
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

GraphQL enum types [only support ASCII alphanumeric characters, digits and underscores with leading non-digit](https://facebook.github.io/graphql/#Name).
If you have other characters, like a dash (`-`) in your Sequelize enum types,
they will be converted to camelCase. If your enum value starts from a digit, it
will be prepended with an underscore.

For example:

- `foo-bar` becomes `fooBar`

- `25.8` becomes `_258`

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

`defaultArgs(Model)` will return an object containing:
 * an arg with a key and type matching your models primary key
 * `where` argument for passing complex query operations described [here](http://docs.sequelizejs.com/en/latest/docs/querying/)
 * `include` that will allow to make a filtering of a model based on sub-models properties
 as described [here](http://docs.sequelizejs.com/manual/tutorial/querying.html#relations-associations)

```js
const User = sequelize.define('User', {
  id: {type: Sequelize.INT, primaryKey: true},
  name: {type: Sequelize.STRING}
});

defaultArgs(User);

/*
{
  id: {
    type: GraphQLScalarType {
      name: 'Int',
      ...
    }
  },
  where: {
    type: GraphQLScalarType {
      name: 'SequelizeJSON',
      ...
    }
  },
  include: {
    type: GraphQLScalarType {
      name: 'SequelizeJSON',
      ...
    }
  }
}
*/
```
Lets take some simple schema and write an examples on each of this properties:
```js
const userType = new GraphQLObjectType({
  name: 'User',
  fields: attributeFields(User)
});

const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'RootQueryType',
    fields: {
      user: {
        type: userType,
        args: defaultArgs(User),
        resolve: resolver(User)
      }
    }
  })
});
```
If your model does not define a primary key it it's schema - Sequelize would add an `id` primary key on it for you.
So `defaultArgs` would return the same result even if there would be no `id` in `User` model definition.
#### primary key parameter
```js
const query = `
  query {
    user (id: 2) {
      id
      name
    }
  }
`;

await graphql(schema, query);

```

#### where

While Sequelize query arguments are starting with "$", according to graphql specification it is not
a valid symbol. So all operators should be used without leading "$". Ex. `$gt` becomes just `gt`.


##### simple query with "where"
```js
const query = `
  query {
    user (where: {name: {like: 'Alex%'}}) {
      id
      name
    }
  }
`;

await graphql(schema, query);
```

##### query with "where" with parameter
```js
const query = `
  query ($name: String) {
    user (where: {name: {like: $name}}) {
      id
      name
    }
  }
`;

const params = {
  name: 'Alex%'
};

await graphql(schema, query, undefined, undefined, params);
```

##### query with "where" as parameter
"where" may be an object or a JSON string. In any case it should have a type of SequelizeJSON
```js
const query = `
  query ($where: SequelizeJSON) {
    user (where: $where) {
      id
      name
    }
  }
`;

const params = {
  where: {name: {like: 'Alex%'}}
};

await graphql(schema, query, undefined, undefined, params);
```
##### query with graphiql
In graphiql you can't define `where` as an object, so you should define it as a JSON string
```
// query

query ($where: SequelizeJSON) {
  user (where: $where) {
    id
    name
  }
}

// query variables
# JSON doesn't allow single quotes, so you need to use escaped double quotes in your JSON string
{
  "where": "{\"name\": {\"like\": \"Alex%\"}}"
}
```
#### include
While in Sequelize `include` main purpose is to load multiple models is a single query,
in graphql-sequelize it extends `where` functionality allowing to filter over sub-models properties.
Because of security reasons it needs an explicit allowance for each model to have each `include` value with 
the `allowedIncludes` option of the [resolver](#options) function.

It is mostly useful for non-scalar types so examples and more details are provided in [defaultListArgs](#defaultlistargs) section.

### defaultListArgs

`defaultListArgs(Model)` is suitable for `GraphQLList` type. It will return an object that contains:
 * `where` argument for passing complex query operations described [here](http://docs.sequelizejs.com/en/latest/docs/querying/)
 * `limit`, `offset` and `order` for pagination and sorting. `order` support `reverse:` prefix for DESC ordering 
 * `include` that will allow to make a filtering of a model based on sub-models properties
 as described [here](http://docs.sequelizejs.com/manual/tutorial/querying.html#relations-associations)

```js
const User = sequelize.define('User', {
  id: {type: Sequelize.INT},
  name: {type: Sequelize.STRING}
});

defaultListArgs(User);

/*
{
  where: {
    type: GraphQLScalarType {
      name: 'SequelizeJSON',
      ...
    }
  },
  limit: {
    type: GraphQLScalarType {
      name: 'Int',
      ...
    }
  },
  offset: {
    type: GraphQLScalarType {
      name: 'Int',
      ...
    }
  },
  order: {
    type: GraphQLScalarType {
      name: 'String',
      ...
    }
  },
  include: {
    type: GraphQLScalarType {
      name: 'SequelizeJSON',
      ...
    }
  }
}
*/
```
Lets define some schema to have examples on this properties
```js
const Project = sequelize.define('Project', {
  id: {type: Sequelize.UUID},
  title: {type: Sequelize.STRING},
});

const userType = new GraphQLObjectType({
  name: 'User',
  fields: attributeFields(User)
});

const projectType = new GraphQLObjectType({
  name: 'Project',
  fields: Object.assign(attributeFields(Project), {
    users: {
      type: new GraphQLList(userType),
      args: defaultListArgs(User),
      resolve: resolver(User)
    }
  })
});

Projects.Users = Projects.hasMany(User);
User.Project = User.belongsTo(Project);

const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'RootQueryType',
    fields: {
      projects: {
        type: new GraphQLList(projectType),
        args: defaultListArgs(Project),
        resolve: resolver(Project, {allowedIncludes: [['User', 'user']]})
      }
    }
  })
});
```

#### where
Is the same as for [defaultArgs(Model)](#where)

#### limit, offset and order
pagination would looks like
```js
const query = `
  query {
    projects (limit: 10, offset: 20, order: "id") {
      id
      title
      users (limit: 5) {
        name
      }
    }
  }
`;

await graphql(schema, query);
```
`order` could be useful even without `limit` and `offset`
```js
const query = `
  query {
    projects (order: "title") {
      id
      title
      users (order: "reverse:name") {
        name
      }
    }
  }
`;

await graphql(schema, query);
```
#### include

Usage of `include` is the only way to filter requested models by it's sub-models values. For example
to paginate over projects with users with specific name:
```js
const query = `
  query ($include: SequelizeJSON) {
    projects (limit: 10, offset: 20, order: "id", include: $include) {
      id
      title
      users {
        name
      }
    }
  }
`;

const params = {
  include: [{model: 'user', where: {name: 'Alex'}}]
}

await graphql(schema, query, undefined, undefined, params);
```
Important that it will return filtered projects with all its users and not just ones with name "Alex".
So usage of `include` **WILL NOT** affect the set of corresponding sub-model entities and **CAN NOT** be used to obtain
sub-model entities. Only to filter the model entities.

Same as `where`, to be used as a query parameter it should be defined with type `SequelizeJSON`.
It should always be an array, even if it has only a single element.

For security reasons to use `include` argument it needs to be explicitly allowed. Each model has it's own list of allowed values.
To allow some values to a model they need to be listed in resolver `allowedInclueds` [options](#options) parameter. 
`allowedInclueds` is an array of strings and arrays of pairs of strings. In the above schema example
`projects` model is allowed to include `User` model by alias `user`. The `User` is the name of an associated
with `Project` Sequelize model, and `user` is the the value that is allowed to be used in query.
If no renaming is needed than a string could be used instead:
```js
...
projects: {
  type: new GraphQLList(projectType),
  args: defaultListArgs(Project),
  resolve: resolver(Project, {allowedIncludes: ['User']}) // <- was {allowedIncludes: [['User', 'user']]}
}
...
```
It is important for `Project` model to be associated with `User` model. Association could be direct
or through another models. `graphql-sequelize` would return an error if `allowedIncludes` would list
a model name that is not in the association chain with the one that is the first `resolver` argument.

#### Nested include

For this example lets extend a schema with Tasks model
```js
const Task = sequelize.define('Task', {
  id: {type: Sequelize.UUID},
  description: {type: Sequelize.STRING},
});

const taskType = new GraphQLObjectType({
  name: 'Task',
  fields: attributeFields(Task)
});

const userType = new GraphQLObjectType({
  name: 'User',
  fields: Object.assign(attributeFields(User), {
    tasks: {
      type: new GraphQLList(taskType),
      args: defaultListArgs(Task),
      resolve: resolver(Task)
    }
  })
});

User.Tasks = User.hasMany(Task);
Task.User = Task.belongsTo(User);

const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'RootQueryType',
    fields: {
      projects: {
        type: new GraphQLList(projectType),
        args: defaultListArgs(Project),
        resolve: resolver(Project, {allowedIncludes: [['User', 'user'], 'Task']})
      }
    }
  })
});
```
now to paginate over projects that have user with task with word "develop" in it's description
```js
const query = `
  query ($include: SequelizeJSON) {
    projects (limit: 10, offset: 20, order: "id", include: $include) {
      id
      title
      users {
        name
      }
    }
  }
`;

const params = {
  include: [{
    model: 'user', 
    include: [{
      model: 'Task', // <- notes "Task" and not "task". Because it was not renamed in allowedIncludes
      where: {
        description: {
          like: "%develop%"}
      }
    }]
  }]
}

await graphql(schema, query, undefined, undefined, params);
```