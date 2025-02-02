const express = require('express');
const fs = require('fs');
const cookieParse = require('cookie-parser');
const dotenv = require('dotenv');
const reqLogMiddleware = require('./depend/logReqs.middleware');
const keySys = require('./depend/keySys')
const ejs = require("ejs");
//console.log(JSON.parse(fs.readFileSync("config/keys.json")));
var books = [];
var transfers = [];
var tokens = [];
var authsys = new keySys;
/*
var temp1usage = 0;
var masterusage = false;
*/
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

function masterController(req,res){
	try{
		switch(req.body.type){
			case 0:
				authsys.addKey(req.body.key,req.body.maxsessions,req.body.unlimit,req.body.master);
				res.status(204).send();
				break;
			case 1:
				if(authsys.removeToken(req.body.keyId,req.body.id)){
					res.status(204).send();
				}else{
					res.status(400).send();
				};
				break;
			case 2:
				authsys.keys[req.body.ind] = null;
				authsys.removeSessionsOfKey(req.body.ind);
				res.status(204).send();
				break;
		}
	}catch(e){
		console.error("Master Error: " + e.stack);
		res.status(500).send();
	}
	res.status(500).send();
} 

async function authController(req,res){
	console.log("Authenticating: "+req.body.key);
	/*
	switch(req.body.key){
		case "pacifikykey":
			if(!masterusage){
				masterusage=true;
				const token = "pacifikykey"+Math.ceil(Math.random()*10000).toString();
				tokens.push(token);
				res.set("Set-Cookie","token="+token+"; Path=/");
				res.status(204).send();
			}
			break;
		case "temppublickey":
			if(temp1usage < 5){
				temp1usage++;
				const token = "temppublickey#"+temp1usage.toString()+":"+Math.ceil(Math.random()*10000).toString();
				tokens.push(token);
				res.set("Set-Cookie","token="+token+"; Path=/");
				res.status(204).send();
			}
			break;
		default:
			break;
	}
	*/
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
	const token = req.signedCookies['token']; //req.cookies.token
	console.log("Logout: "+token);
	/*
	if(tokens.includes(token)){
		if(token.substr(0,12) == "bdtoken69lol"){
			masterusage=false;
			tokens.splice(tokens.indexOf(token),1);
		}else if(token.substr(0,9) == "ptemp691#"){
			tokens.splice(tokens.indexOf(token),1);
		}
	}
	*/
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
	res.status(404);
	res.render("notfound");
	//res.end('<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>404 Not found</title></head><body><h1>Hmmm... Didn\'t find anything ~(^_^)~</h1><span id="caption">Welcome to Project KV31 also known as "The Backrooms"</span><a href="/">Return home?</a><footer>Copyright Frost 2025. CC-BY-SA</footer></body></html>')
}

function reqController(req,res){
	console.log("Request message:"+req.body.msg);
	fs.appendFile("./logs/tokenrequests.txt",`[${(new Date()).toISOString()},${req.socket.remoteAddress} : ${req.body.msg} \n`,err => {
		if (err) {
		  console.error("Token Error: "+err);
		}
		// done!
	});
	res.status(204).send();
	//res.end('<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Successfully requested!</title><link rel="stylesheet" type="text/css" href="book.css"></head><body><h1>Hmmm... Didn\'t find anything ~(^_^)~</h1><footer>Copyright Frost 2025. CC-BY-SA</footer></body></html>');
}

/*
function validToken(token){
	if(tokens.includes(token)){return true}else{return false};
}
*/

async function bookController(req,res,next){
	const token = req.signedCookies['token']; //req.cookies.token
	console.log("Mainpage Validation:"+token);
	/*
	if(validToken(token)){
		res.end('<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Pacific Book Database</title><link rel="icon" href="/favicon.ico"><link rel="stylesheet" type="text/css" href="/book.css"></head><body><h1>Pacific Book Database</h1><span id="caption">Welcome to the Pacific book database portal</span><button id="pb-logoutbtn">Log Out</button><div class="list">' + books + '</div><hr><div class="list">' + transfers + '</div><footer>Copyright Frost 2025. CC-BY-SA</footer><script>const lgoutbtn = document.getElementById("pb-logoutbtn");lgoutbtn.addEventListener("click",()=>{fetch("/session", {method: "DELETE"}).then(res=>{if(res.status==204){window.location.reload();}else{alert("Request Error "+res.status.toString());};});});</script></body></html>')
	}else{
		res.end('<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Pacific Book Database</title><link rel="icon" href="/favicon.ico"><link rel="stylesheet" type="text/css" href="/book.css"></head><body class="mainback"><div class="logincontainer"><h1>Pacific Book Database</h1><span id="caption">Please Authenticate.</span><div class="login"><h3>Login</h3><input id="keyinput" placeholder="Your Key" type="password"></input><button id="keylogin">Login</button><hr/><h3>Request a key</h3><input id="reqinput" placeholder="Message"></input><button id="reqkey">Request Key</button></div><footer>Copyright Frost 2025. CC-BY-SA</footer></div><script>const loginbtn = document.getElementById("keylogin");const logininp = document.getElementById("keyinput");const reqbtn = document.getElementById("reqkey");const reqinput = document.getElementById("reqinput");reqbtn.addEventListener("click",()=>{fetch("/request",{method: "POST",headers: {"Content-Type": "application/json"},body: JSON.stringify({msg: reqinput.value})}).then(res=>{if(res.status == 204){alert("Message sent!");}else{alert("Error: "+res.status.toString());};});});loginbtn.addEventListener("click",()=>{fetch("/session", {method: "POST",headers: {"Content-Type": "application/json"},body: JSON.stringify({key: logininp.value})}).then(res=>{if(res.status==204){window.location.reload();}else{alert("Invalid KEY!");};});});</script></body></html>')
	}
	*/
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