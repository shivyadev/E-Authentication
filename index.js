const express = require('express');
const app = express();
const mongoose = require('mongoose');
const User = require('./models/user');
const UserOTPVerification = require('./models/UserOTPVerification');
const bcrypt = require('bcrypt');
const session = require('express-session');
const nodemailer = require('nodemailer');
const {EMAIL,PASSWORD} = require('./env');
const loginRecord = require('./models/loginrecord');

mongoose.connect('mongodb+srv://shivanshtest:It7WaCCtNfxoqGcq@cluster0.c9hje4n.mongodb.net/?retryWrites=true&w=majority')
    .then(() => {
        console.log("MONGO CONNECTION OPEN!!!")
    })
    .catch(err => {
        console.log("OH NO MONGO CONNECTION ERROR!!!!")
        console.log(err)
    })

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: EMAIL,
        pass: PASSWORD
    }
})

app.set('view engine','ejs');
app.set('views','views');

app.use(express.static(__dirname + '/public'));
app.use(express.urlencoded({ extended: true }));
app.use(session({ 
    secret: 'secretid',
    resave: false,
    saveUninitialized: true,
}));

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

app.get('/', (req,res) => {
    res.render('index')
})

app.get('/register', (req,res) =>{
    res.render('register')
})

app.post('/register', async (req,res) =>{
    const {firstName, lastName, username, password, email, contact, authMethod} = req.body;
    const hash = await bcrypt.hash(password,12);
    const user = new User({
        firstName,
        lastName,
        username,
        password: hash,
        email,
        contact,
    })
    await user.save();
    
    req.session.userId = user._id;
    if(authMethod === 'OTP'){
        sendOTPVerification(user,res);
        res.redirect('otp');
    }
    else
        res.send("QR Not Available");


})

app.post('/login', async (req,res) =>{
    const {username, password} = req.body;
    try{
        if(!username){
            throw Error('Missing Username')
        }
        const user = await User.findOne({username});
        
        if(!user){
            throw Error("Invalid Username");
        }

        const validPassword = await bcrypt.compare(password, user.password);
        
        
        if(validPassword){
            req.session.userId = user._id;
            if(req.body.authMethod === 'OTP'){
                res.redirect('otp');
                sendOTPVerification(user,res);
            }else{
                res.send("QR Not Available");
            }
        }
        else
            console.log('Try Again');
        
    }catch(error){
        console.log(error.message);
    }
})

app.post('/logout', async (req,res) => {
    const currentTimeIST = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
    try{
        await loginRecord.updateOne({userId: req.session.userId}, {$set: {logout: currentTimeIST}})
        console.log("Updated");
    }catch(error){
        console.log("Not updated");
    }
    req.session.userId = null;
    res.redirect('/');
})


app.get('/otp', (req,res) => {
    if(!req.session.userId)
        res.redirect('/');
    else
        res.render('otp');
})

app.post('/otp', async (req,res) => {
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

app.post('/resendOTP', async (req,res) =>{
    try{
        const _id = req.session.userId;
        const searchUser = await User.findOne({_id});
        const userId = _id;
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

app.get('/loginrecord', async (req,res) => {
    if(!req.session.userId)
        res.redirect('/');
    else {
        const userId = req.session.userId;
        const loginRecords = await loginRecord.find({ userId });
        
        res.render('loginrecord',{loginRecords});
    }
})


app.listen(3000, () =>{
    console.log({ User })
})