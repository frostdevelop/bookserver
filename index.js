const express = require('express');
const fs = require('fs');
const cookieParse = require('cookie-parser');
const dotenv = require('dotenv');
const reqLogMiddleware = require('./depend/logReqs.middleware');
const keySys = require('./depend/keySys');
const ejs = require("ejs");
const PacificShelf = require('./depend/shelf');
//Later make a sqlite config for different "shelves" on the books
//Turn library to a class later for routing logic
const library = [new PacificShelf('Books','book'),new PacificShelf('Transfer','trans')];

let authsys = new keySys;
dotenv.config();

if(!process.env.SECRET){console.error('Error: Missing cookie secret!');process.exit(0);}

const app = express();

app.use(cookieParse(process.env.SECRET));
app.use(express.json());
app.set('view engine','ejs');

if(process.env.LOG ?? false) app.use(reqLogMiddleware);
if(process.env.PROXY ?? false) app.enable('trust proxy');

const TOKEN_DURATION = 15*60*1000;

function updFS(){
	library[0].clearBooks();
	library[1].clearBooks();
	fs.readdirSync(process.env.BOOKDIR).forEach(file=>library[0].addBook(file));
	fs.readdirSync(process.env.TRANSDIR).forEach(file=>library[1].addBook(file));
}

function reloadController(req,res){
	//Maybe I should require auth here
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
					res.status(200);
					res.end((await authsys.addKey(req.body.name,req.body.key,req.body.maxsessions,req.body.unlimit,req.body.master)).toString());

					const logdata = "["+(new Date()).toISOString()+"] "+req.signedCookies['token']+" :AddKey: "+req.body.key;
					console.log(logdata);
					if(process.env.MASTERLOG){
						fs.appendFile("./logs/master.log",logdata+"\n",err => {
							if (err) console.error("Master Log Error: "+err);
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
							if (err) console.error("Master Log Error: "+err);
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
		const expiryTime = Date.now()+TOKEN_DURATION;
		const token = await authsys.addSession(req.body.key,expiryTime);
		if(token){
			res.cookie('token',token,{
				httpOnly:true,
				secure:true,
				signed:true,
				path:"/",
				sameSite:"Lax",
				maxAge:TOKEN_DURATION,
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
	console.log("Logout: "+token);
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
	const expiryTime = Date.now()+TOKEN_DURATION;

	const index = await authsys.checkThenModify(token,expiryTime);
	if(index != null){
		res.cookie('token',token,{
			httpOnly:true,
			secure:true,
			signed:true,
			path:"/",
			sameSite:"Lax",
			maxAge:TOKEN_DURATION,
		});
	}else{
		res.cookie('token','',{maxAge:0});
	}
	return index;
}

async function validateUserMiddleware(req,res,next){
	const token = req.signedCookies['token'];

	console.log("Token Validation Attempt:"+token);
	
	try{
		if((await checkAndExtendTokenTime(token,res)) != null){
			next();
		}else{
			console.log("Invalid token");

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
			if(err) console.error("Token Error: "+err);
		}
	);
	
	res.status(204).send();
}

async function bookController(req,res,next){
	const token = req.signedCookies['token']; //req.cookies.token
	const mir = req.headers['x-frost-mir'] === '1' ? '/books' : '';
	if(token){
		console.log("Mainpage Validation:"+token);
		try{
			const session = await checkAndExtendTokenTime(token,res);
			if(session != null){
				console.log("Authenticated: "+session);
				res.render("main",{
					verified: true,
					library: library,
					master: authsys.keys[authsys.tokens[session].key].master,
					sessions: authsys.tokens,
					keys: authsys.keys,
					sessionIndex: session,
					loggedOut: false,
					mir: mir,
				});
			}else{
				res.render("main",{
					verified: false,
					library: null,
					keys: null,
					sessions: null,
					master: false,
					loggedOut: true,
					mir: mir,
				});
			}
		}catch(e){
			console.error("Get session Error: " + e.stack);
			res.status(400).send(); //"Invalid Format!"
		}
	}else{
		console.log("Login Serve");
		res.render("main",{
			verified: false,
			library: null,
			keys: null,
			loggedOut: false,
			sessions: null,
			master: false,
			mir: mir,
		});
	}
}

const contentRouter = new express.Router();
contentRouter.use(validateUserMiddleware);
contentRouter.use("/book",express.static(process.env.BOOKDIR));
contentRouter.use("/transfer",express.static(process.env.TRANSDIR));

updFS();

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