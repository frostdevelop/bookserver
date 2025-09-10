const express = require('express');
const fs = require('fs');
const cookieParse = require('cookie-parser');
const dotenv = require('dotenv');
const reqLogMiddleware = require('./depend/logReqs.middleware');
const keySys = require('./depend/keySys')
const ejs = require("ejs");
var books = [];
var transfers = [];
var authsys = new keySys;
dotenv.config();

if(!process.env.SECRET){console.error('Error: Missing cookie secret!');process.exit(0);}

const app = express();
app.use(cookieParse(process.env.SECRET));
app.use(express.json());
if(process.env.LOG ?? false){
	app.use(reqLogMiddleware);
}
app.set('view engine','ejs');
if(process.env.PROXY ?? false){
	app.enable('trust proxy');
}

function updFS(){
	books.length = 0;
	transfers.length = 0;
	fs.readdirSync('./public/book/').forEach(file => {
		if(file == "desktop.ini"){
			return
		}
		books.push(file);
	})

	fs.readdirSync('./public/transfer/').forEach(file => {
		if(file == "desktop.ini"){
			return
		}
		transfers.push(file);
	})
}

function reloadController(req,res){
	console.log("Reloading files...");
	updFS();
	res.status(204).send();
}

async function masterController(req,res){
	console.log(req.signedCookies['token']+" Requests Master");
	try{
		if(await authsys.isMaster(req.signedCookies['token'])){
			switch(req.body.type){
				case 0:{
					/*authsys.addKey(req.body.key,req.body.maxsessions,req.body.unlimit,req.body.master).then(ind=>{
						res.status(200);
						res.end(ind);
					});*/
					res.status(200);
					res.end((await authsys.addKey(req.body.key,req.body.maxsessions,req.body.unlimit,req.body.master)).toString());
					const logdata = "["+(new Date()).toISOString()+"] "+req.signedCookies['token']+" :AddKey: "+req.body.key;
					console.log(logdata);
					if(process.env.MASTERLOG){
						fs.appendFile("./logs/master.log",logdata+"\n",err => {
							if (err) {
								console.error("Master Log Error: "+err);
							}
						});
					}
					break;
				}
				case 1:{
					if(authsys.removeToken(req.body.keyId,req.body.id)){
						res.status(204).send();
					}else{
						res.status(400).send();
					};
					const logdata = "["+(new Date()).toISOString()+"] "+req.signedCookies['token']+" :RemoveSess: "+req.body.keyId;
					console.log(logdata);
					if(process.env.MASTERLOG){
						fs.appendFile("./logs/master.log",logdata+"\n",err => {
							if (err) {
								console.error("Master Log Error: "+err);
							}
						});
					}
					break;
				}
				case 2:{
					authsys.keys[req.body.ind] = null;
					await authsys.removeSessionsOfKey(req.body.ind);
					res.status(204).send();
					const logdata = "["+(new Date()).toISOString()+"] "+req.signedCookies['token']+" :RemoveKey: "+req.body.ind.toString();
					console.log(logdata);
					if(process.env.MASTERLOG){
						fs.appendFile("./logs/master.log",logdata+"\n",err => {
							if (err) {
								console.error("Master Log Error: "+err);
							}
						});
					}
					break;
				}
			}
		}else{
			console.log("Master Denied");
			res.status(403).send();
		}
	}catch(e){
		console.error("Master Error: " + e.stack);
		res.status(500).send();
	}
	res.status(500).send();
} 

async function authController(req,res){
	console.log("Authenticating: "+req.body.key);
	try{
		const token = await authsys.addSession(req.body.key);
		if(token){
			res.cookie('token',token,{httpOnly:true,secure:true,signed:true,path:"/"});
			res.status(204).send();
		}else{
			res.status(401).send();
		}
	}catch(e){
		console.error("Add session Error: " + e.stack);
		res.status(500).send(); //"Invalid Format!"
	}
}

async function logoutController(req,res){
	const token = req.signedCookies['token'];
	console.log("Logout: "+token);
	try{
		if(await authsys.removeSession(token)){
			res.cookie('token','',{maxAge:Date.now()});
			res.status(204).send();
		}else{
			res.status(401).send();
		}
	}catch(e){
		console.error("Remove session Error: " + e.stack);
		res.status(500).send(); //"Invalid Format!"
	}
}

async function validateUserMiddleware(req,res,next){
	const token = req.signedCookies['token']; //req.cookies.token
	console.log("Token Validation Attempt:"+token);
	try{
		if(await authsys.isValid(token)){ //validToken(token)
			next();
		}else{
			console.log("Invalid token");
			notFoundController(req,res);
		}
	}catch(e){
		console.error("Validation Error: " + e.stack);
		res.status(500).send(); //"Invalid Format!"
	}
}

function notFoundController(req,res){
	let mir = '';
	if(req.headers['x-frost-mir'] == '1'){
		mir = '/books';
	}
	res.status(404);
	res.render("notfound", {
		mir:mir,
	});
}

function reqController(req,res){
	console.log("Request message:"+req.body.msg);
	fs.appendFile("./logs/tokenrequests.txt",`[${(new Date()).toISOString()},${req.ip} : ${req.body.msg} \n`,err => {
		if (err) {
		  console.error("Token Error: "+err);
		}
		// done!
	});
	res.status(204).send();
}

async function bookController(req,res,next){
	const token = req.signedCookies['token']; //req.cookies.token
	console.log("Mainpage Validation:"+token);
	let mir = '';
	if(req.headers['x-frost-mir'] == '1'){
		mir = '/books';
	}
	if(token){
		try{
			const session = await authsys.getSession(token);
			res.render("main",{
				verified: (session ? true : false),
				books: books,
				transfers: transfers,
				master: (session ? authsys.keys[session.key].master : false),
				sessions: authsys.tokens,
				keys: authsys.keys,
				curr: (session ? session.key : null),
				mir: mir,
			});
		}catch(e){
			console.error("Get session Error: " + e.stack);
			res.status(500).send(); //"Invalid Format!"
		}
	}else{
		res.render("main",{
			verified: false,
			books: null,
			transfers: null,
			keys: null,
			sessions: null,
			master: false,
			mir: mir,
		});
	}
}

updFS();

app.use("/book/*",validateUserMiddleware);
app.use("/transfer/*",validateUserMiddleware);
app.use(express.static("./public"));

app.get("/", bookController);
app.post("/session",authController);
app.post("/request",reqController);
app.delete("/session",logoutController);
app.head("/reload",reloadController);
app.post("/master",masterController);
app.get("*",notFoundController);

(async ()=>{
	await authsys.load("./config/keys.json");
	app.listen(process.env.PORT ?? 80, err=>{
		if(err){
			console.error("Error on start: "+err);
		}else{
			console.log("Successfully started on "+process.env.PORT.toString());
		}
	});
})()