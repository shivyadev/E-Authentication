const express = require('express');
const app = express();
const mongoose = require('mongoose');
const User = require('./models/user');
const bcrypt = require('bcrypt');
const session = require('express-session');
const {MONGO_URL} = require('./env');
const {router: authenticationRouter, sendOTPVerification} = require('./routes/authentication');
const loginRecord = require('./models/loginrecord');
const UserOTPVerification = require('./models/UserOTPVerification');

mongoose.connect(MONGO_URL)
    .then(() => {
    })
    .catch(err => {
        console.error(err)
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
app.use(authenticationRouter);

app.get('/', async(req,res) => {
    res.render('index');
})

app.get('/login', (req,res) => {
    res.render('login');
})

app.get('/register', (req,res) =>{
    res.render('register')
})

app.post('/register', async (req,res) =>{
    const {firstName, lastName, username, password, email, authMethod} = req.body;
    const hash = await bcrypt.hash(password,12);
    
    const user = new User({
        firstName,
        lastName,
        username,
        password: hash,
        email,
        secret: "",
    })
    
    await user.save();

    req.session.userId = user._id;
    if(authMethod === 'OTP'){
        sendOTPVerification(user,res);
        res.redirect('otp');
    }
    else
        res.redirect('registerQR');
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
                res.redirect('loginQR');
            }
        }
        else
            console.error('Try Again');
    }catch(error){
        console.error(error.message);
    }
})

app.get('/logout', async (req,res) => {
    const currentTimeIST = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
    try{
        const latestLoginRecord = await loginRecord.findOne({userId: req.session.userId}).sort({time:-1});

        if(latestLoginRecord)
            await loginRecord.updateOne({_id: latestLoginRecord._id},{$set: {logout: currentTimeIST}});
        else
            throw Error('Missing Record');
        
    }catch(error){
        console.error(error.message);
    }
    req.session.userId = null;
    res.redirect('/');
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


app.listen(3000);