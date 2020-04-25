import Sequelize from 'sequelize';

const sequelize = new Sequelize('graphql_sequelize_test', 'root', '', {
  host: 'localhost',
  dialect: 'sqlite',
});

export default sequelize;
