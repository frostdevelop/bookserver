const express = require('express');
const Shelf = require('./shelf');
const fs = require('fs');

class Library {
    constructor(fileToLoad=""){
        this.shelves = new Map();
        this.file = fileToLoad;
        if(fileToLoad){
            try{
                console.log(`[Library] Loading file: ${fileToLoad}`);
                const libraryFile = JSON.parse(fs.readFileSync(fileToLoad));
                for(const [name,path] of Object.entries(libraryFile.shelves)){
                    console.log(`[Library] Adding shelf ${name}: ${path}`);
                    this.addShelf(new Shelf(path),name);
                }
                console.log(`[Library] File successfully loaded`);
            }catch(e){
                throw new Error(`[Library] File load failure: ${e.stack}`)
            }
        }
    }
    addShelf(shelf,name){
        if(!this.shelves.has(name)){
            this.shelves.set(name,shelf);
            return true;
        }
        return false;
    }
    removeShelf(name){
        if(!this.shelves.has(name)){
            this.shelves.delete(name);
            return true;
        }
        return false;
    }
    loadShelves(){
        console.log(`[Library] Loading ${this.shelves.size} shelves.`)
        for(const [name, shelf] of this.shelves){
            console.log(`[Library] @${name} Loading...`);
            try{
                console.log(`[Library] @${name} Loaded ${shelf.load()} books`);
            }catch(e){
                throw new Error(`[Library] @${name} Load failure: ${e.stack}`)
            }
        }
        console.log(`[Library] Load successful`)
    }
    addShelvesToRouter(router){
        console.log("[Library] Attaching shelves to router");
        for(const [name,shelf] of this.shelves){
            console.log(`[Library] @${name} Attaching: ${shelf.path}`);
            router.use("/"+name,express.static(shelf.path));
        }
        console.log("[Library] Attaching successful");
    }
}

module.exports = Library;