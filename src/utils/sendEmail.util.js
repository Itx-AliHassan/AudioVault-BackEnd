const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const accountCreate = async (user) => { }

const accountLogin = async (user) => { }

const accountForgotPassword = async (user) => { }

const emailVerification = async (user) => { }

const songUpload = async (user) => { }

module.exports = { accountCreate, accountLogin, accountForgotPassword, emailVerification, songUpload };