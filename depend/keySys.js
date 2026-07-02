const fs = require('fs');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const tokengen = require('./tokengen');

//update to use redis later
//this is a session authentication system btw im stu pid
//goodness this code is hideous

class keySys{
    constructor(){ //file=null
        this.keys = [];
        this.tokens = [];
    }
    async load(file){
        const keyfile = JSON.parse(fs.readFileSync(file)); //"config/keys.json"
        this.keys = new Array(keyfile.keys.length);
        for(let i=0;i<keyfile.keys.length;i++){
            let hash = keyfile.keys[i].key;

            switch(keyfile.keys[i].level ?? 0){
                case 0:
                    //console.log(crypto.createHash('sha256').update(hash).digest('hex'));

                    hash = await bcrypt.hash(crypto.createHash('sha256').update(hash).digest('hex'),10);
                    break;
                case 1:
                    hash = await bcrypt.hash(hash,10);
            }

            this.keys[i] = {
                hash: hash,
                maxsession: keyfile.keys[i].maxsession ?? 1,
                usage: 0,
                unlimit: !(keyfile.keys[i].limitusage || false),
                master: (keyfile.keys[i].master || false),
            };
        }
    }
    async addSession(key,expiryTime){
        for(let i=0;i<this.keys.length;i++){
            if(this.keys[i] && this.keys[i].usage < this.keys[i].maxsession){
                if(await bcrypt.compare(key,this.keys[i].hash)){
                    console.log(`+${i.toString()}:${this.keys[i].usage.toString()}:${this.tokens.length}:${(new Date(expiryTime)).toLocaleString()}`);

                    const token = tokengen(32);
                    this.tokens.push({token: await bcrypt.hash(token,5),key:i,id:this.keys[i].usage,expiryTime:expiryTime});
                    this.keys[i].usage++;

                    return token;
                }
            }
        }
        return null;
    }
    async modifySession(token,expiryTime){
        for(let i=0;i<this.tokens.length;i++){
            if(await bcrypt.compare(token,this.tokens[i].token)){
                this.tokens[i].expiryTime=expiryTime;
                console.log(`^${i.toString()}:${(new Date(expiryTime)).toLocaleString()}`)
                return true;
            }
        }
        return false;
    }
    async removeSession(token){
        for(let i=0;i<this.tokens.length;i++){
            if(await bcrypt.compare(token,this.tokens[i].token)){
                const tkobj = this.tokens.splice(i,1)[0];
                const keyobj = this.keys[tkobj.key];
                if(keyobj && keyobj.unlimit) keyobj.usage--;

                console.log(`-${tkobj.key.toString()}:${keyobj.usage.toString()}`)
                return true;
            }
        }
        return false;
    }
    async isValid(token){
        for(let i=0;i<this.tokens.length;i++){
            if(await bcrypt.compare(token,this.tokens[i].token)){
                //This uses index, vulnerable bug fr
                const associatedKey = this.tokens[i].key;

                if(this.keys[associatedKey]){
                    if(this.tokens[i].expiryTime > Date.now()){
                        return true;
                    }else{
                        this.tokens.splice(i,1);
                    }
                }else{
                    this.tokens.splice(i,1);

                    for(let j=this.tokens.length-1;j>=0;j--){
                        if(this.tokens[j].key == associatedKey){this.tokens.splice(j,1)}
                    }
                }
                return false;
            }
        }
        return false;
    }
    async isMaster(token){
        for(let i=0;i<this.tokens.length;i++){
            if(await bcrypt.compare(token,this.tokens[i].token)){
                const currkey = this.tokens[i].key;
                if(this.keys[currkey]){
                    if(this.keys[this.tokens[i].key].master){return true;}else{return false;};
                }else{
                    this.tokens.splice(i,1);
                    for(let j=this.tokens.length-1;j>=0;j--){
                        if(this.tokens[j].key == currkey){this.tokens.splice(j,1)}
                    }
                    return false;
                }
            }
        }
        return false;
    }
    async addKey(key,maxsession=1,unlimit=true,master=false){
        const hash = await bcrypt.hash(key,10);
        this.keys.push({
            hash:hash,
            maxsession:maxsession,
            unlimit:unlimit,
            master:master,
            usage:0
        });
        return this.keys.length-1;
    }
    async getSession(token){
        for(let i=0;i<this.tokens.length;i++){
            if(await bcrypt.compare(token,this.tokens[i].token)){
                return this.tokens[i];
            }
        }
        return null;
    }
    async getSessionIndex(token){
        for(let i=0;i<this.tokens.length;i++){
            if(await bcrypt.compare(token,this.tokens[i].token)){
                return i;
            }
        }
        return null;
    }
    removeToken(keyid,id){
        for(let i=0;i<this.tokens.length;i++){
            if(this.tokens[i].key == keyid && this.tokens[i].id == id){
                const keyobj = this.keys[this.tokens[i].key];
                keyobj.unlimit && keyobj.usage--;
                console.log(this.tokens[i].key.toString() + ":" + keyobj.usage.toString());
                this.tokens.splice(i,1);
                return true;
            }
        }
        return false;
    }
    removeInvalidSessions(){
        for(let i=this.tokens.length-1;i>=0;i--){
            if(!this.keys[this.tokens[i].key]){this.tokens.splice(i,1);}
        }
    }
    removeSessionsOfKey(keyId){
        for(let i=this.tokens.length-1;i>=0;i--){
            if(this.tokens[i].key == keyId){this.tokens.splice(i,1);}
        }
    }
}

module.exports = keySys;