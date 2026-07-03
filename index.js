const express = require('express');
const cookieParse = require('cookie-parser');
const dotenv = require('dotenv');
const reqLogMiddleware = require('./depend/logReqs.middleware');
const keySys = require('./depend/keySys');
const ejs = require("ejs");
const Library = require('./depend/library');
const fs = require('fs');

//Later make a sqlite config for different "shelves" on the books and allow upload
//Add server sent events for admin panel

dotenv.config();

let authsys = new keySys(parseInt(process.env.SESSION_CLEANUP_INTERVAL));
if(!process.env.SECRET){console.error('Error: Missing cookie secret!');process.exit(0);}

const library = new Library('./config/library.json');

const app = express();

app.use(cookieParse(process.env.SECRET));
app.use(express.json());
app.set('view engine','ejs');

if(process.env.LOG ?? false) app.use(reqLogMiddleware);
if(process.env.PROXY ?? false) app.enable('trust proxy');

const SESSION_TIMEOUT = parseInt(process.env.SESSION_TIMEOUT);

function reloadController(req,res){
	//Maybe I should require auth here
	library.loadShelves();
	res.status(204).send();
}

async function masterController(req,res){
	console.log("(Admin) Validating "+req.signedCookies['token']);
	try{
		const sessionID = await checkAndExtendTokenTime(req.signedCookies['token'],res);
		if(sessionID != null && authsys.isMasterByID(sessionID)){
			let logMessage = "["+(new Date()).toISOString()+"] "+sessionID.toString()+":"+authsys.getUserByID(sessionID).toString()+":"+req.ip;
			switch(req.body.type){
				case 0:{
					logMessage += " +Key "+req.body.key;
					if(await authsys.addKey(req.body.name,req.body.key,req.body.maxsession,req.body.unlimit,req.body.master)){
						res.status(204).send();
					}else{
						logMessage += " (Failed)";
						res.status(400).send();
					}
					break;
				}
				case 1:{
					logMessage += " -Session "+req.body.id;
					if(authsys.removeSessionByID(req.body.id)){
						res.status(204).send();
					}else{
						logMessage += " (Failed)";
						res.status(400).send();
					};
					break;
				}
				case 2:{
					logMessage += " -Key "+req.body.name;
					if(authsys.removeKey(req.body.name)){
						authsys.removeSessionsOfKey(req.body.name);
						res.status(204).send();
					}else{
						logMessage += " (Failed)";
						res.status(400).send();
					}
					break;
				}
			}
			console.log("(Admin) "+logMessage);
			if(process.env.MASTERLOG){
				fs.appendFile("./logs/master.log",logMessage+"\n",err => {
					if (err) {
						console.error("Master Log Error: "+err);
					}
				});
			}
		}else{
			console.log("(Admin) Not Admin: "+req.signedCookies['token']);
			res.status(403).send();
		}
	}catch(e){
		console.error("Master Error: " + e.stack);
		res.status(500).send();
	}
	res.status(500).send();
} 

async function authController(req,res){
	console.log("(Auth) Authenticating: "+req.body.key);
	try{
		const expiryTime = Date.now()+SESSION_TIMEOUT;
		const token = await authsys.addSession(req.body.key,expiryTime);
		if(token){
			res.cookie('token',token,{
				httpOnly:true,
				secure:true,
				signed:true,
				path:"/",
				sameSite:"Lax",
				maxAge:SESSION_TIMEOUT,
			});
			res.status(204).send();
		}else{
			res.status(401).send();
		}
	}catch(e){
		console.error("Add session Error: " + e.stack);
		res.status(400).send(); //"Invalid Format!"
	}
}

async function logoutController(req,res){
	const token = req.signedCookies['token'];
	console.log("(Auth) Logout: "+token);
	try{
		if(await authsys.removeSession(token)){
			res.cookie('token','',{maxAge:0});
			res.status(204).send();
		}else{
			res.status(401).send();
		}
	}catch(e){
		console.error("Remove session Error: " + e.stack);
		res.status(400).send(); //"Invalid Format!"
	}
}

async function checkAndExtendTokenTime(token,res){
	const expiryTime = Date.now()+SESSION_TIMEOUT;

	const index = await authsys.checkThenModify(token,expiryTime);
	if(index != null){
		res.cookie('token',token,{
			httpOnly:true,
			secure:true,
			signed:true,
			path:"/",
			sameSite:"Lax",
			maxAge:SESSION_TIMEOUT,
		});
	}else{
		res.cookie('token','',{maxAge:0});
	}
	return index;
}

async function validateUserMiddleware(req,res,next){
	const token = req.signedCookies['token'];

	console.log("(Auth) Authenticating: "+token);
	
	try{
		if((await checkAndExtendTokenTime(token,res)) != null){
			console.log("(Auth) Authenticated: "+token);
			next();
		}else{
			console.log("(Auth) Invalid token: "+token);

			notFoundController(req,res);
		}
	}catch(e){
		console.error("Validation Error: " + e.stack);
		res.status(400).send(); //"Invalid Format!"
	}
}

function notFoundController(req,res){
	const mir = req.headers['x-frost-mir'] === '1' ? '/books' : '';
	res.status(404).render("notfound", {
		mir:mir,
	});
}

function reqController(req,res){
	console.log("Request message:"+req.body.msg);

	fs.appendFile("./logs/tokenrequests.txt",
		`${Date.now().toString(36)}:${req.ip}:${req.body.msg}\n`,
		err => {
			if(err) console.error("Token Request Error: "+err);
		}
	);
	
	res.status(204).send();
}

async function bookController(req,res,next){
	const token = req.signedCookies['token'];
	const mir = req.headers['x-frost-mir'] === '1' ? '/books' : '';
	if(token){
		console.log("(Main) Authenticating "+token);
		try{
			const sessionID = await authsys.getSessionID(token);
			if(sessionID != null){
				console.log("(Main) Authenticated: "+sessionID);
				res.render("main",{
					verified: true,
					library: library.shelves,
					master: authsys.isMasterByID(sessionID),
					sessions: authsys.sessions,
					keys: authsys.keys,
					sessionID: sessionID,
					loggedOut: false,
					mir: mir,
				});
			}else{
				console.log("(Main) Invalid token: "+token);
				res.render("main",{
					verified: false,
					keys: null,
					sessions: null,
					loggedOut: true,
					mir: mir,
				});
			}
		}catch(e){
			console.error("Get session Error: " + e.stack);
			res.status(400).send(); //"Invalid Format!"
		}
	}else{
		res.render("main",{
			verified: false,
			keys: null,
			loggedOut: false,
			sessions: null,
			mir: mir,
		});
	}
}

const contentRouter = new express.Router();
contentRouter.use(validateUserMiddleware);
library.addShelvesToRouter(contentRouter);
library.loadShelves();

app.use("/content",contentRouter);
app.use(express.static('./public'));
app.get("/", bookController);
app.post("/session",authController);
app.post("/request",reqController);
app.delete("/session",logoutController);
app.head("/reload",reloadController);
app.post("/master",masterController);
app.use(notFoundController);
app.use((err, req, res, next) => {
	console.log(err);
	res.status(500).send("Our server is having a meltdown!");
});

(async ()=>{
	try{
		await authsys.load("./config/keys.json");
		app.listen(process.env.PORT ?? 80, err=>{
			if(err){
				console.error("Error on start: "+err);
			}else{
				console.log("Successfully started on "+process.env.PORT.toString());
			}
		});
	}catch(err){
		console.log("Authsys loading error: ",err);
	}
})()