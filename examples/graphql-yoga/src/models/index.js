import fs from 'fs';
import path from 'path';
import Sequelize from 'sequelize';

import sequelize from '../config/database';

const db = {
  sequelize,
  Sequelize,
};

fs
  .readdirSync(__dirname)
  .filter(file =>
    path.extname(file) === '.js' &&
    file !== 'index.js',
  )
  .forEach((file) => {
    const model = sequelize.import(path.join(__dirname, file));
    db[model.name] = model;
  });

Object.keys(db).forEach((modelName) => {
  if ('associate' in db[modelName]) {
    db[modelName].associate(db);
  }
});

export default db;
