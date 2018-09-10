import Sequelize, { Model } from 'sequelize';

class Pet extends Model {
  static tableName = 'pets';

  static associate(models) {
    Pet.Owner = Pet.belongsTo(models.User, {
      as: 'owner',
    });
  }
}

export default (sequelize) => {
  Pet.init({
    name: Sequelize.STRING,
    ownerId: {
      type: Sequelize.INTEGER,
    },
  }, {
    sequelize,
    tableName: Pet.tableName,
  });

  return Pet;
};
