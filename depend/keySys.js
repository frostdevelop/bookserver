const fs = require('fs');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const tokengen = require('./tokengen');

//update to use redis later
//this is a session authentication system btw im stu pid

class keySys{
    constructor(){ //file=null
        this.keys = [];
        this.tokens = [];
        this.removeInvalidSessions = this.removeInvalidSessions.bind(this);
		setInterval(this.removeInvalidSessions,1800000);//Every 30 mins
    }
    async load(file){
        console.log("Loading Key File: "+file);

        const keyfile = JSON.parse(fs.readFileSync(file));
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
				name: keyfile.keys[i].name,
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
                    const token = tokengen(32);
					
                    console.log(`+${this.keys[i].name}:${this.keys[i].usage.toString()}:${this.tokens.length}:${token}:${(new Date(expiryTime)).toLocaleString()}`);

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
    async checkThenModify(token,expiryTime){
        const sessionIndex = await this.getSessionIndex(token);
		if(sessionIndex != null){
			this.tokens[sessionIndex].expiryTime=expiryTime;
			console.log(`^${sessionIndex.toString()}:${(new Date(expiryTime)).toLocaleString()}`)
		}
        return sessionIndex;
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
                const associatedKey = this.tokens[i].key;

                if(this.keys[associatedKey]){
                    if(this.tokens[i].expiryTime > Date.now()){
                        return true;
                    }else{
                        this.tokens.splice(i,1);
                    }
                }else{
                    this.tokens.splice(i,1);
					this.removeSessionsOfKey(associatedKey);
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
                    this.removeSessionsOfKey(currkey);
                    return false;
                }
            }
        }
        return false;
    }
    async addKey(name,key,maxsession=1,unlimit=true,master=false){
        const hash = await bcrypt.hash(key,10);
		if(!name)name="Unnamed "+this.keys.length;
        this.keys.push({
			name:name,
            hash:hash,
            maxsession:maxsession,
            unlimit:unlimit,
            master:master,
            usage:0
        });
        return this.keys.length-1;
    }
    async getSession(token){
		const sessionIndex = await this.getSessionIndex(token);
        return sessionIndex != null ? this.tokens[sessionIndex] : null;
    }
    async getSessionIndex(token){
        for(let i=0;i<this.tokens.length;i++){
            if(await bcrypt.compare(token,this.tokens[i].token)){
                const associatedKey = this.tokens[i].key;

                if(this.keys[associatedKey]){
                    if(this.tokens[i].expiryTime > Date.now()){
                        return i;
                    }else{
                        this.tokens.splice(i,1);
                    }
                }else{
                    this.tokens.splice(i,1);
					this.removeSessionsOfKey(associatedKey);
                }
                return null;
            }
        }
        return null;
    }
	getSessionTokenByIndex(index){
		return this.keys[this.tokens[index]?.key];
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
        console.log("Removing Invalid Sessions");
        for(let i=this.tokens.length-1;i>=0;i--){
            if(!this.keys[this.tokens[i].key]){
                console.log(`-${this.tokens[i].key.toString()}:${this.tokens[i].id}`);
                this.tokens.splice(i,1);
            }else if(this.tokens[i].expiryTime < Date.now()){
                console.log(`-${this.tokens[i].key.toString()}:${this.tokens[i].id}`);
                this.keys[this.tokens[i].key].unlimit && this.keys[this.tokens[i].key].usage--;
                this.tokens.splice(i,1);
            }
        }
    }
    removeSessionsOfKey(keyId){
        for(let i=this.tokens.length-1;i>=0;i--){
            if(this.tokens[i].key == keyId){
                console.log(`-${this.tokens[i].key.toString()}:${this.tokens[i].id}`);
                this.tokens.splice(i,1);
            }
        }
    }
}

module.exports = keySys;