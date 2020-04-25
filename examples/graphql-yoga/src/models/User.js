import Sequelize, { Model } from 'sequelize';

class User extends Model {
  static tableName = 'users';

  static associate(models) {
    User.Pets = User.hasMany(models.Pet, {
      foreignKey: 'ownerId',
      as: 'pets',
    });
  }
}

const schema = {
  name: Sequelize.STRING,
};

export default (sequelize) => {
  User.init(schema, {
    sequelize,
    tableName: User.tableName,
  });

  return User;
};
