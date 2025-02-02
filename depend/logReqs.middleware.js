const fs = require('fs');
module.exports  = (req,res,next)=>{
	let content = `[${(new Date()).toISOString()}] ${req.ip} ${req.url} ${req.method} \n`; //req.socket.remoteAddress
	console.log(content);
	fs.appendFile('./logs/requests.log', content, err => {
		if (err) {
			console.error("Request Write Error: "+err);
		}
	});
	next();
}