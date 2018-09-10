import server from './server';
import models from './models';

/**
 * DISCLAIMER: using sequelize#sync is not recommended for production use. Please, please
 * use migrations. This method of creating a database is used in this demo for simplicity's sake.
 */
async function start() {
  // Make sure the database tables are up to date
  await models.sequelize.sync({ force: true });

  // Create sample data
  const foo = await models.User.create({ name: 'Foo' });
  const bar = await models.User.create({ name: 'Bar' });
  await foo.createPet({ name: 'Bat' });
  await bar.createPet({ name: 'Baz' });

  // Start the GraphQL server
  server.start(() => {
    console.log('Server is running on localhost:4000');
  });
}

start();

