const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required: [true, "Username is required to create an account"], unique: [true, "Username must be unique to create an account this username is already register"], },
    fullName: { type: String, required: [true, "fullname is required to create an account"], },
    email: { type: String, required: [true, "A email is required to create an account"], unique: [true, "Email should be unique to create an account this email is already register"], },
    password: { type: String, required: [true, "Password is required to create an account"], select: false, },
    role: { type: String, enum: ['user', 'admin'], default: 'user' }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

module.exports = User;