'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class Scuola extends Model {}

Scuola.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  nome: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  }
}, {
  sequelize,
  modelName: 'Scuola',
  tableName: 'scuole',
  timestamps: true,
});

module.exports = Scuola;