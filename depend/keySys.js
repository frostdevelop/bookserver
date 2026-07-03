const fs = require('fs');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const tokengen = require('./tokengen');
let sessionCount = 0;

//update to use redis later
//add setting permanent keys toggle?

class keySys{
    constructor(cleanup_interval){ //file=null
        this.keys = new Map();
        this.sessions = new Map();
        this.cleanup = this.cleanup.bind(this);
		setInterval(this.cleanup,cleanup_interval);
    }
    async load(file){
        console.log("[KeySys] Loading Key File: "+file);

        const keyfile = JSON.parse(fs.readFileSync(file));
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

            this.keys.set(keyfile.keys[i].name, {
                hash: hash,
                maxsession: keyfile.keys[i].maxsession ?? 1,
                usage: 0,
                unlimit: !(keyfile.keys[i].limitusage || false),
                master: (keyfile.keys[i].master || false),
            });
        }

        console.log("[KeySys] Loaded "+this.keys.size+" keys");
    }
    async addSession(key,expiryTime){
        for(let [name, keyObj] of this.keys.entries()){
            if(keyObj && keyObj.usage < keyObj.maxsession){
                if(await bcrypt.compare(key,keyObj.hash)){
                    const token = tokengen(32);
					
                    console.log(`[KeySys-Session] +${sessionCount}:${name}:${token}:${(new Date(expiryTime)).toLocaleString()}`);
                    keyObj.usage++;
                    this.sessions.set(sessionCount++, {token: await bcrypt.hash(token,5), key: name, expiryTime: expiryTime});

                    return token;
                }
            }
        }
        return null;
    }
    async modifySession(token,expiryTime){
        for(let [id, sessionObj] of this.sessions.entries()){
            if(await bcrypt.compare(token, sessionObj.token)){
                sessionObj.expiryTime = expiryTime;
                console.log(`[KeySys-Session] ^${id.toString()}:${(new Date(expiryTime)).toLocaleString()}`)
                return true;
            }
        }
        return false;
    }
    async checkThenModify(token,expiryTime){
        const sessionID = await this.getSessionID(token);
		if(sessionID != null){
			this.sessions.get(sessionID).expiryTime=expiryTime;
			console.log(`[KeySys-Session] ^${sessionID.toString()}:${(new Date(expiryTime)).toLocaleString()}`)
		}
        return sessionID;
    }
    async removeSession(token){
        for(let [id, sessionObj] of this.sessions.entries()){
            if(await bcrypt.compare(token, sessionObj.token)){
                return this.removeSessionByID(id);
            }
        }
        return false;
    }
    async isValid(token){
        for(let [id, sessionObj] of this.sessions.entries()){
            if(await bcrypt.compare(token, sessionObj.token)){
                const associatedKey = sessionObj.key;

                if(this.keys.get(associatedKey)){
                    if(sessionObj.expiryTime > Date.now()){
                        return true;
                    }else{
                        this.sessions.delete(id);
                    }
                }else{
                    this.sessions.delete(id);
					this.removeSessionsOfKey(associatedKey);
                }
                return false;
            }
        }
        return false;
    }
    async isMaster(token){
        for(let [id, sessionObj] of this.sessions.entries()){
            if(await bcrypt.compare(token, sessionObj.token)){
                const associatedKey = sessionObj.key;
                const keyObj = this.keys.get(associatedKey);
                if(keyObj){
                    if(keyObj.master){return true;}else{return false;};
                }else{
                    this.sessions.delete(id);
                    this.removeSessionsOfKey(associatedKey);
                    return false;
                }
            }
        }
        return false;
    }
    isMasterByID(id){
        const sessionObj = this.sessions.get(id);
        if(sessionObj){
            const associatedKey = sessionObj.key;
            const keyObj = this.keys.get(associatedKey);
            if(keyObj){
                return keyObj.master;
            }else{
                this.sessions.delete(id);
                this.removeSessionsOfKey(associatedKey);
                return false;
            }
        }
        return false;
    }
    async addKey(name,key,maxsession=1,unlimit=true,master=false){
        const hash = await bcrypt.hash(key,10);
        if(!name || this.keys.has(name) || !key || maxsession < 1) return false;
        this.keys.set(name, {
            hash:hash,
            maxsession:maxsession,
            unlimit:unlimit,
            master:master,
            usage:0
        });
        console.log(`[KeySys-Key] +${name}:${key}:${maxsession}:${unlimit}:${master}`);
        return true;
    }
    async getSession(token){
		const sessionID = await this.getSessionID(token);
        return sessionID != null ? this.sessions.get(sessionID) : null;
    }
    async getSessionID(token){
        for(let [id, sessionObj] of this.sessions.entries()){
            if(await bcrypt.compare(token, sessionObj.token)){
                const associatedKey = sessionObj.key;

                if(this.keys.get(associatedKey)){
                    if(sessionObj.expiryTime > Date.now()){
                        return id;
                    }else{
                        this.sessions.delete(id);
                    }
                }else{
                    this.sessions.delete(id);
					this.removeSessionsOfKey(associatedKey);
                }
                return null;
            }
        }
        return null;
    }
	getSessionKeyByID(id){
		const sessionObj = this.sessions.get(id);
		return sessionObj ? this.keys.get(sessionObj.key) : null;
	}
    removeSessionByID(id){
        const sessionObj = this.sessions.get(id);
        if(sessionObj){
            this.sessions.delete(id);
            const keyobj = this.keys.get(sessionObj.key);
            if(keyobj){
                if(keyobj.unlimit){
                    keyobj.usage--
                }else if(keyobj.usage === keyobj.maxsession){
                    this.removeKey(keyId)
                }
            }
            console.log(`[KeySys-Session] -${id}:${sessionObj.key}`)
            return true;
        }
        return false;
    }
    cleanup(){
        console.log(`[KeySys] Cleaning up data...`);
        for(let [id, sessionObj] of this.sessions.entries()){
            if(!this.keys.get(sessionObj.key)){
                console.log(`[KeySys-Session] -${id}:${sessionObj.key}`);
                this.sessions.delete(id);
            }else if(sessionObj.expiryTime < Date.now()){
                console.log(`[KeySys-Session] -${id}:${sessionObj.key}`);
                const keyobj = this.keys.get(sessionObj.key);
                keyobj.unlimit && keyobj.usage--;
                this.sessions.delete(id);
            }
        }
    }
    removeSessionsOfKey(keyId){
        for(let [id, sessionObj] of this.sessions.entries()){
            if(sessionObj.key == keyId){
                console.log(`[KeySys-Session] -${id}:${sessionObj.key}`);
                this.sessions.delete(id);
            }
        }
    }
    removeKey(keyId){
        if(this.keys.has(keyId)){
            this.keys.delete(keyId);
            console.log(`[KeySys-Key] -${keyId}`);
            return true;
        }
        return false;
    }
    getUserByID(id){
        const sessionObj = this.sessions.get(id);
        return sessionObj ? sessionObj.key : null;
    }
}

module.exports = keySys;