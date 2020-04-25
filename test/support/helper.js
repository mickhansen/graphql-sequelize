import Sequelize from 'sequelize';

export const Promise = Sequelize.Promise;
export const sequelize = createSequelize();

export function createSequelize(options = {}) {
  const env = process.env;
  const dialect = env.DIALECT || 'sqlite';
  const config = Object.assign(
    {
      host: 'localhost',
      user: 'graphql_sequelize_test',
      password: 'graphql_sequelize_test',
      database: 'graphql_sequelize_test'
    },
    dialect === 'postgres' && {
      host: env.POSTGRES_PORT_5432_TCP_ADDR,
      user: env.POSTGRES_ENV_POSTGRES_USER,
      password: env.POSTGRES_ENV_POSTGRES_PASSWORD,
      database: env.POSTGRES_ENV_POSTGRES_DATABASE
    },
    dialect === 'mysql' && {
      host: env.MYSQL_PORT_3306_TCP_ADDR,
      user: env.MYSQL_ENV_MYSQL_USER,
      password: env.MYSQL_ENV_MYSQL_PASSWORD,
      database: env.MYSQL_ENV_MYSQL_DATABASE
    },
    dialect === 'postgres' && env.CI && {
      user: 'postgres',
      password: '',
      database: 'test'
    },
    dialect === 'mysql' && env.CI && {
      user: 'travis',
      password: '',
      database: 'test'
    }
  );

  return new Sequelize(config.database, config.user, config.password, {
    host: config.host,
    dialect: dialect,
    logging: false,
    ...options
  });
}

export function beforeRemoveAllTables() {
  before(function () {
    if (sequelize.dialect.name === 'mysql') {
      this.timeout(10000);
      return removeAllTables(sequelize);
    }
  });
}

// Not nice too, MySQL does not supports same name for foreign keys
// Solution ? Force remove all tables!
export function removeAllTables(sequelize) {
  function getTables() {
    return sequelize.query('show tables').then(tables => tables[0].map((table) => table.Tables_in_test));
  }

  return getTables()
    .then(tables => {
      return Promise.all(tables.map(table => {
        return sequelize.query('drop table ' + table).catch(() => {});
      }));
    })
    .then(() => {
      return getTables();
    })
    .then(tables => {
      if (tables.length) {
        return removeAllTables(sequelize);
      }
    });
}
