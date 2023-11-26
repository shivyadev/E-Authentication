const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const UserOTPVerfiySchema = new Schema({
    userId: String,
    otp: String,
    createdAt: Date,
    expiresAt: Date
})

module.exports = mongoose.model('UserOTPVerification', UserOTPVerfiySchema);