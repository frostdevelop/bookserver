class shelf{
    constructor(name,path,books=[]){
        this.name = name;
        this.path = path;
        this.books = books;
    }
    clearBooks(){
        this.books.length = 0;
    }
    addBook(b){
        this.books.push(b);
    }
}

module.exports = shelf;