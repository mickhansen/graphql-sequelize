
import Sequelize from 'sequelize';

export const Promise = Sequelize.Promise
export const sequelize = createSequelize()

export function createSequelize () {
  const dialect = process.env.DB === 'pgsql' ? 'postgres' : (process.env.DB || 'sqlite');
  const host = process.env.DB_PORT_5432_TCP_ADDR || process.env.DB_PORT_3306_TCP_ADDR;
  let user = 'test';
  const database = 'test';
  const password = 'test';

  if (dialect === 'postgres' && process.env.CI)
    user = 'postgres';

  return new Sequelize(database, user, password, {
    host: host,
    dialect: dialect,
    logging: false
  });
}
