# graphql-sequelize and Relay

graphql-sequelize can setup and handle connection cursors and slicing for you.

## node lookups

relay will perform certain queries on a root "node" type.
graphql-sequelize will automatically map these node lookups to findById calls.

```js
import {relay: {sequelizeNodeInterface}} from 'graphql-sequelize';
improt sequelize from './your-sequelize-instance';

const {
  User
} = sequelize;

const {
  nodeInterface,
  nodeField,
  nodeTypeMapper
} = sequelizeNodeInterface(sequelize);

const userType = new GraphQLObjectType({
  name: models.User.name,
  fields: {
    id: globalIdField(models.User.name),
    name: {
      type: GraphQLString
    }
  },
  interfaces: [nodeInterface]
});

nodeTypeMapper.mapTypes({
  [models.User.name]: userType
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