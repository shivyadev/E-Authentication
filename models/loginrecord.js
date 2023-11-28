const mongoose = require('mongoose');
const Schema = mongoose.Schema;


const loginRecordSchema = new Schema({
    userId: String,
    firstName: String,
    lastName: String,
    login: String,
    logout: String,
    time: Date,
})

module.exports = mongoose.model('loginRecord',loginRecordSchema);