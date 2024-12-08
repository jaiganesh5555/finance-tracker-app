
//Tools require for construction of building
const express=require('express');
const app=express();
const dotenv=require('dotenv');
const path=require('path'); //Inbuilt package
const cors = require('cors');

// Middleware
app.use(express.json()); // For parsing application/json
app.use(cors()); // If your frontend and backend are on different origins

// parse request to body parser
const bodyparser=require('body-parser')
app.use(bodyparser.urlencoded({extended: true}))

const bcrypt = require('bcrypt');

const { initializeApp,cert} = require('firebase-admin/app');
const { getFirestore} = require('firebase-admin/firestore');
var serviceAccount = require("./key.json");
initializeApp({
  credential: cert(serviceAccount),
  ignoreUndefinedProperties: true
});
const db = getFirestore();

//set view engine
app.set('view engine','ejs');
app.set('views',path.join(__dirname,'views'));//dynamic changes in html 

//load assests
app.use(express.static(path.join(__dirname,'assets')));




//Front door-using tools
app.get('/about',(req,res)=>{
    res.render('about');
})

app.get('/contact',(req,res)=>{
    res.render('contact');
})

app.get('/',(req,res)=>{
    res.render('home');
})

app.get('/signup',(req,res)=>{
    const alertMessage=req.query.alertMessage;
    res.render('signup',{alertMessage});
})

app.post('/signupsubmit',async (req,res)=>{
    try{
    const newUser = {
        username: req.body.name,
        email: req.body.email,
        password: await bcrypt.hash(req.body.password, 10)
    };

    const userRef = db.collection('User-info');
    const namequery= await userRef.where('username', '==', newUser.username).get();                             
    if(!namequery.empty){
        const alertMessage = 'Username already exists';
        return res.redirect(`/signup?alertMessage=${encodeURIComponent(alertMessage)}`);
    } 
    const emailquery = await userRef.where('email', '==', newUser.email).get();                             
    if(!emailquery.empty){
        const alertMessage = 'EmailId already exists';
        return res.redirect(`/signup?alertMessage=${encodeURIComponent(alertMessage)}`);
    } 
    await userRef.add(newUser);
    const alertMessage = 'User Registered Successfully';
    return res.redirect(`/login?alertMessage=${encodeURIComponent(alertMessage)}`);

    }   
    catch{
        const alertMessage = 'An error occurred during registration. Please try again later.';
        return res.redirect(`/signup?alertMessage=${encodeURIComponent(alertMessage)}`);
    }                    
})

app.get('/login',(req,res)=>{
    const alertMessage=req.query.alertMessage;
    res.render('login',{alertMessage});
})

app.post('/loginsubmit',async (req,res)=>{
    try{
    const info=db.collection('User-info');
    const snapshot=await info.where('email','==',req.body.email).get();
    if(snapshot.empty){
        const alertMessage='Email not registered please create an acccount';
        return res.redirect(`/login?alertMessage=${encodeURIComponent(alertMessage)}`);
    }
    else{
        const userdoc=snapshot.docs[0];
        const storedpassword=userdoc.data().password;
        const isPasswordCorrect = await bcrypt.compare(req.body.password,storedpassword);

        if (isPasswordCorrect){
            const alertMessage='Login successfully'
            const email=req.body.email
            return res.redirect(`/dashboard?alertMessage=${encodeURIComponent(alertMessage)}&email=${encodeURIComponent(email)}`);
        }
        else{
            const alertMessage='Password and Email-Id mismatched please verify'
            return res.redirect(`/login?alertMessage=${encodeURIComponent(alertMessage)}`);
        } 
    }
    }
    catch (error) {
        console.error('Error during login:', error);
        const alertMessage = 'An error occurred during login. Please try again later.';
        return res.redirect(`/login?alertMessage=${encodeURIComponent(alertMessage)}`);
    }
})
  

app.get('/dashboard',(req,res)=>{
    const alertMessage=req.query.alertMessage;
    const userEmail=req.query.email;
    res.render('dashboard',{alertMessage,userEmail});
})

app.post('/addtransaction',async (req,res)=>{
    try{
    const trans={
        Date: req.body.date,
        TypeofTransaction: req.body.typeoftrans,
        Description: req.body.description,
        Amount: req.body.amount
    }
    const userdocs=db.collection('User-info').doc(req.body.email);
    const transactionsRef=userdocs.collection('Transaction Details');
    await transactionsRef.add(trans);
    const alertMessage='Transaction added Successfully';
    res.redirect(`/dashboard?alertMessage=${encodeURIComponent(alertMessage)}&email=${encodeURIComponent(req.body.email)}`);
    }catch(error){
        const alertMessage='Error in adding transaction';
        return res.redirect(`/dashboard?alertmessage=${encodeURIComponent(alertMessage)}`);
    }
})


app.post('/transactionhistory', async (req, res) => {
    try {
        const from = req.body.fromdate;
        const to = req.body.todate;
        const userEmail = req.body.email;

        const userdocs = db.collection('User-info').doc(userEmail);
        const subdocs = userdocs.collection('Transaction Details');
        const snap = await subdocs.where('Date', '>=', from)
                                  .where('Date', '<=', to)
                                  .get();
        const transactions = [];
        let Totalamount = 0;
        snap.forEach(doc => {
            const data = doc.data();
            data.id = doc.id;
            transactions.push(data);
            Totalamount += parseFloat(data.Amount);
        });
        const alertMessage = req.body.alertMessage;
        res.render('transactionhistory', { transactions, Totalamount, alertMessage, userEmail });                   
    } catch (error) {
        const alertMessage = 'An error occurred while fetching transactions.';
        res.redirect(`/dashboard?alertMessage=${encodeURIComponent(alertMessage)}&email=${encodeURIComponent(req.body.email)}`);
    }                                                         
});


app.post('/analysis',async(req,res)=>{
   try{
        const selectedYear=req.body.year;
        const selectedMonth=req.body.month;
        
        const userdocs=db.collection('User-info').doc(req.body.email);
        const subdocs=userdocs.collection('Transaction Details');
        const startdate=`${selectedYear}-${selectedMonth}-01`;
        const enddate=`${selectedYear}-${selectedMonth}-31`;
        try{
        const snapfood=await subdocs.where('TypeofTransaction','==','food')
                                    .where('Date', '>=', startdate)
                                    .where('Date', '<=', enddate)
                                    .get();
        let foodamount=0;
        snapfood.forEach(doc=>{
            foodamount+=parseFloat(doc.data().Amount)
        })
        const snapbills=await subdocs.where('TypeofTransaction','==','bills')
                                     .where('Date','>=',startdate)
                                     .where('Date', '<=', enddate)
                                     .get();

        let billamount=0;
        snapbills.forEach(doc=>{
            billamount+=parseFloat(doc.data().Amount)
        })
        const snapfees=await subdocs.where('TypeofTransaction','==','clgfees')
                                    .where('Date','>=',startdate)
                                    .where('Date', '<=', enddate)
                                    .get();

        let feeamount=0;
        snapfees.forEach(doc=>{
            feeamount+=parseFloat(doc.data().Amount)
        })
        const snapaccess=await subdocs.where('TypeofTransaction','==','homeacces')
                                      .where('Date','>=',startdate)
                                      .where('Date', '<=',enddate)
                                      .get();

        let accessamount=0;
        snapaccess.forEach(doc=>{
            accessamount+=parseFloat(doc.data().Amount)
        })
        const snapother=await subdocs.where('TypeofTransaction','==','others')
                                    .where('Date', '>=', startdate)
                                    .where('Date', '<=', enddate)
                                    .get();
        let otheramount=0;
        snapother.forEach(doc=>{
            otheramount+=parseFloat(doc.data().Amount)
        })
        res.render('analysis',{foodamount,billamount,feeamount,accessamount,otheramount});
        }catch(error){
            console.error("Database Query Error:", error);
            const alertmessage="An error occured Due to database Query";
            res.redirect(`/dashboard?alertMessage=${encodeURIComponent(alertmessage)}&email=${encodeURIComponent(req.body.email)}`)
        }
    }
    catch(error){
        console.error("Database Query Error:", error);
        const alertmessage="An error occured While Analysis";
        res.redirect(`/dashboard?alertMessage=${encodeURIComponent(alertmessage)}&email=${encodeURIComponent(req.body.email)}`)
    }
})

app.delete('/deleteTransaction/:transactionId/:email', async (req, res) => {
    const transactionId = req.params.transactionId;
    const userEmail = req.params.email;

    try {
        const userDocRef = db.collection('User-info').doc(userEmail);
        const transactionDocRef = userDocRef.collection('Transaction Details').doc(transactionId);
        await transactionDocRef.delete();
        res.status(200).json({ message: "Transaction Deleted Successfully" });
    } catch (error) {
        console.error('Error deleting transaction:', error);
        res.status(500).json({ error: 'An error occurred while deleting the transaction' });
    }
});

app.put('/updateTransaction/:transactionId/:email', async (req, res) => {
    const transactionId = req.params.transactionId;
    const userEmail = req.params.email;
    const { date, typeoftrans, description, amount } = req.body;
    console.log(req.body)

    // Check for undefined fields and handle accordingly
    if (date === undefined || typeoftrans === undefined || description === undefined || amount === undefined) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    try {
        const userDocRef = db.collection('User-info').doc(userEmail);
        const transactionDocRef = userDocRef.collection('Transaction Details').doc(transactionId);
        await transactionDocRef.update({
            Date: date,
            TypeofTransaction: typeoftrans,
            Description: description,
            Amount: amount
        });
        res.status(200).json({ message: "Transaction Updated Successfully" });
    } catch (error) {
        console.error('Error updating transaction:', error);
        res.status(500).json({ error: 'An error occurred while updating the transaction' });
    }
});



//port initializtion
dotenv.config({path:'config.env'})
const port=process.env.PORT||3000;
app.listen(port, () => {
    console.log(`The server is running on: http://localhost:${port}`);
});

