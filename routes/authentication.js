const express = require('express');
const router = express.Router();
const User = require('../models/user');
const UserOTPVerification = require('../models/UserOTPVerification');
const loginRecord = require('../models/loginrecord');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const speakeasy = require('speakeasy');
const QRcode = require('qrcode');
const {EMAIL,PASSWORD} = require('../env');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: EMAIL,
        pass: PASSWORD
    }
})

const createLoginRecord = async (userId) => {
    const user = await User.findOne({ _id: userId });

    if (!user) {
        console.error('User not found for userId:', userId);
        throw Error("Misisng user");
    }

    const currentTimeIST = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
    const newloginRecord = new loginRecord({
        userId,
        firstName: user.firstName,
        lastName: user.lastName,
        login: currentTimeIST,
        logout: "",
        time: new Date(),
    });

    await newloginRecord.save();
};

const sendOTPVerification = async({_id: userId,email},res) => {
    try{
        const otp = `${Math.floor(100000 + Math.random() * 900000)}`;

        const mailOptions = {
            from: EMAIL,
            to: email,
            subject: 'E-AUTHENTICATION OTP',
            html: `<p>Your otp for E - Authentication is: ${otp}.<br> 
            The otp will expire in 5 minutes.</p>`,
        };

        const id = userId;
        const hashedOTP = await bcrypt.hash(otp, 12);
        console.log('Id:',id);
        const newOTPVerification = new UserOTPVerification({
            userId: id,
            otp: hashedOTP,
            createdAt: Date.now(),
            expiresAt: Date.now() + 300000,
        })

        await newOTPVerification.save();
        await transporter.sendMail(mailOptions);

    }catch(error){
        console.log(`${error.message}`);
    }
}

const verifyOTP = async(otp,userId,res) => {
    
    const UserOTPVerificationRecords = await UserOTPVerification.findOne({userId});
        
    if(!UserOTPVerificationRecords){
        throw new Error(
            "Account record does not exist."
        );
    }else {
        const expiresAt = UserOTPVerificationRecords.expiresAt;
        const hashedOTP = UserOTPVerificationRecords.otp;
        if(expiresAt < Date.now()){
            await UserOTPVerification.deleteMany({userId});
            throw new Error("Code has expired. Please request again")
        }else{
            
            const validOTP = await bcrypt.compare(otp, hashedOTP);

            if(!validOTP){
                throw new Error("Invalid Code Passed. Check your indox")
            }else{
                await UserOTPVerification.deleteMany({userId});
                try{
                    await createLoginRecord(userId);    
                }catch(error){
                    console.log('Error: ',error.message);
                }

                res.redirect("loginrecord");
            }
        }
    }
}

router.get('/otp', (req,res) => {

    if(!req.session){
        console.log("ERORRRRRR");
    }

    if(!req.session.userId)
        res.redirect('/');
    else
        res.render('otp');
})

router.post('/otp', async (req,res) => {
    try{
        const {otp} = req.body;
        const userId = req.session.userId;

        if(!otp)
            throw Error("Empty otp details are not allowed");

        verifyOTP(otp,userId,res);

    }catch(error){
        console.log(`${error.message}`)
    }
})

router.post('/resendOTP', async (req,res) =>{
    try{
        const userId = req.session.userId;
        const searchUser = await User.findOne({_id: userId});
        if(!searchUser){
            console.Error('User not found');
        } else{
            await UserOTPVerification.deleteMany({userId});
            sendOTPVerification(searchUser,res);
            res.redirect('/otp');
        }
    }catch(error) {
        console.log('Error: ',error.message);
    }
})

router.get('/registerQR', async (req,res) => {

    try{

        const temp_secret = speakeasy.generateSecret();
        const user = await User.findOne({_id: req.session.userId});

        user.secret = temp_secret.base32;

        const urlData = await QRcode.toDataURL(temp_secret.otpauth_url);
        await user.save();

        res.render('registerQR', {urlData : urlData});

    }catch(error){
        console.log(error);
    }
})

router.get('/loginQR', (req,res) =>{
    res.render('loginQR');
})

router.post('/verifyQR', async (req,res) =>{

    try{

        const userId = req.session.userId;
        const { token } = req.body;

        console.log(token,userId);

        const user = await User.findOne({_id: userId});
        const secret = user.secret;

        console.log(secret);

        const verified = speakeasy.totp.verify({
            secret,
            encoding: 'base32',
            token
        })

        console.log(verified);

        if(!verified)
            throw Error("Unknown Token Value");

        await createLoginRecord(userId);
        res.redirect("loginrecord");

    }catch(error){
        console.log(error);

       
    }
})

module.exports = { router, sendOTPVerification };