const express = require('express')
const fs = require('fs')
const app = express()
var books = "";
var transfers = "";

fs.readdirSync('./public/book/').forEach(file => {
	if(file == "desktop.ini"){
		return
	}
	books = books + `<div class='book'><a href="/book/` + file + `">` + file + `</a></div>`;
})

fs.readdirSync('./public/transfer/').forEach(file => {
	if(file == "desktop.ini"){
		return
	}
	transfers = transfers + `<div class='book'><a href="/transfer/` + file + `">` + file + `</a></div>`;
})

app.use(express.static("./public"))

app.get("/", (req,res)=>{
	res.end('<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Books</title><link rel="stylesheet" type="text/css" href="book.css"></head><body><h1>Pacific Books</h1><p id="caption">Welcome to the Pacific book database portal</p><div class="list">' + books + '</div><hr><div class="list">' + transfers + '</div></body></html>')
})

app.listen(3000, ()=>{
	console.log("Started")
})