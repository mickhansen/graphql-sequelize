# graphql-sequelize and Relay

## node lookups

relay will perform certain queries on a root "node" type.
graphql-sequelize will automatically map these node lookups to findById calls.

```js
import {relay: {sequelizeNodeInterface}} from 'graphql-sequelize';
import sequelize from './your-sequelize-instance';

const {
  User
} = sequelize;

const {
  nodeInterface,
  nodeField,
  nodeTypeMapper
} = sequelizeNodeInterface(sequelize);

const userType = new GraphQLObjectType({
  name: User.name,
  fields: {
    id: globalIdField(User.name),
    name: {
      type: GraphQLString
    }
  },
  interfaces: [nodeInterface]
});

nodeTypeMapper.mapTypes({
  [User.name]: userType
});

const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'RootType',
    fields: {
      user: {
        type: userType,
        args: {
          id: {
            type: new GraphQLNonNull(GraphQLInt)
          }
        },
        resolve: resolver(User)
      },
      node: nodeField
    }
  })
});
```

If you make sure to call `nodeTypeMapper.mapTypes` with all your graphql types matching your sequelize models all node with global id lookups will work.
You can also add any non-model mapping you'd like to `mapTypes'.

## connections

Preliminary design, not implemented yet.
graphql-sequelize's sequelizeConnection will automatically handle pagination via cursors, first, last, before, after and orderBy.

```js
import {relay: {sequelizeConnection}} from 'graphql-sequelize';
import sequelize from './your-sequelize-instance';

const {
  User,
  Task
} = sequelize;


const taskType = new GraphQLObjectType({
  name: Task.name,
  fields: {
    id: globalIdField(Task.name),
    title: {
      type: GraphQLString
    }
  }
});

const userTaskConnection = sequelizeConnection({
  name: Task.name,
  nodeType: taskType,
  target: User.Tasks | User // Can be an association for parent related connections or a model for "anonymous" connections
  orderBy: new GraphQLEnumType({
    name: 'UserTaskOrderBy',
    values: {
      AGE: ['createdAt', 'DESC'], // The first ENUM value will be the default order. The order will be used for `first`, will automatically be inversed for `last` lookups.
      FIRST_NAME: 'firstName' // ASC per default
    }
  }),
  // if no orderBy is specified the model primary key will be used.
  where: function (key, value) {
    // for custom args other than connectionArgs return a sequelize where parameter

    return {[key]: value};
  }
});

const userType = new GraphQLObjectType({
  name: User.name,
  fields: {
    id: globalIdField(User.name),
    name: {
      type: GraphQLString
    },
    // or simply use tasks: userTaskConnection
    tasks: {
      type: userTaskConnection.connectionType,
      args: userTaskConnection.connectionArgs,
      resolve: userTaskConnection.resolve
    }
  }
});

```
