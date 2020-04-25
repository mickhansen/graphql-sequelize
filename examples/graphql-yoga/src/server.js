import { GraphQLServer } from 'graphql-yoga';
import { createContext, EXPECTED_OPTIONS_KEY } from 'dataloader-sequelize';
import { resolver } from 'graphql-sequelize';
import models from './models';

const typeDefs = `
  type Query {
    pet(id: ID!): Pet
    pets: [Pet]
    user(id: ID!): User
    users: [User]
  }

  type User {
    id: ID!
    name: String
    pets: [Pet]
  }

  type Pet {
    id: ID!
    name: String
    owner: User
  }
`;

const resolvers = {
  Query: {
    pet: resolver(models.Pet),
    pets: resolver(models.Pet),
    user: resolver(models.User),
    users: resolver(models.User),
  },
  User: {
    pets: resolver(models.User.Pets),
  },
  Pet: {
    owner: resolver(models.Pet.Owner),
  },
};

// Tell `graphql-sequelize` where to find the DataLoader context in the
// global request context
resolver.contextToOptions = { [EXPECTED_OPTIONS_KEY]: EXPECTED_OPTIONS_KEY };

const server = new GraphQLServer({
  typeDefs,
  resolvers,
  context(req) {
    // For each request, create a DataLoader context for Sequelize to use
    const dataloaderContext = createContext(models.sequelize);

    // Using the same EXPECTED_OPTIONS_KEY, store the DataLoader context
    // in the global request context
    return {
      [EXPECTED_OPTIONS_KEY]: dataloaderContext,
    };
  },
});

export default server;
