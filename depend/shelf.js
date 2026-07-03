const fs = require('fs');

class Shelf {
    constructor(path,books=[]){
        this.path = path;
        this.books = books;
    }
    clearBooks(){
        this.books.length = 0;
    }
    addBook(b){
        this.books.push(b);
    }
    load(){
        this.clearBooks();
        fs.readdirSync(this.path).forEach(file=>this.addBook(file));
        return this.books.length;
    }
}

module.exports = Shelf;