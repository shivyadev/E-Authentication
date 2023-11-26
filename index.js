const express = require('express');
const app = express();
const mongoose = require('mongoose');
const User = require('./models/user');
const bcrypt = require('bcrypt');
const session = require('express-session');
const {router: authenticationRouter, sendOTPVerification} = require('./routes/authentication');


const loginRecord = require('./models/loginrecord');

mongoose.connect('mongodb+srv://shivanshtest:It7WaCCtNfxoqGcq@cluster0.c9hje4n.mongodb.net/?retryWrites=true&w=majority')
    .then(() => {
        console.log("MONGO CONNECTION OPEN!!!")
    })
    .catch(err => {
        console.log("OH NO MONGO CONNECTION ERROR!!!!")
        console.log(err)
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