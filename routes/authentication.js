const express = require('express');
const router = express.Router();
const User = require('../models/user');
const UserOTPVerification = require('../models/UserOTPVerification');
const loginRecord = require('../models/loginrecord');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const {EMAIL,PASSWORD} = require('../env');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: EMAIL,
        pass: PASSWORD
    }
})

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
                        const user = await User.findOne({_id: userId}); 
                        const currentTimeIST = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
                        const newloginRecord = new loginRecord({
                            userId,
                            firstName: user.firstName,
                            lastName: user.lastName,
                            login: currentTimeIST,
                            logout: ""
                        })

                        await newloginRecord.save();
                    }catch(error){
                        console.log('Error: ',error.message);
                    }
                    res.redirect("loginrecord");
                }
            }
        }
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

module.exports = { router, sendOTPVerification };