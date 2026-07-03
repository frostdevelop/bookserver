const adminpanel = document.getElementById('pb-AdminPanel');
const adminheader = adminpanel.getElementsByClassName('header')[0];
const keyinp = document.getElementById('pb-kc-ncinp');
const sessinp = document.getElementById('pb-kc-maxinp');
const keyNameInput = document.getElementById('pb-kc-keyName');
const limchk = document.getElementById('pb-kc-limit');
const mstchk = document.getElementById('pb-kc-master');
const keysub = document.getElementById('pb-kc-submit');
const sessionlist = document.getElementById('pb-sessionlist');
let sessionends = sessionlist.getElementsByClassName('pb-sessionend');
const keylist = document.getElementById('pb-keylist');
let keyinvalids = keylist.getElementsByClassName('pb-keyinvalid');
let moving = false;
let offsetx = 0;
let offsety = 0;

async function endSessionReq() {
	const vals = this.value.split(":");
	const res = await fetch(frostMir + "/master", {
		method: "POST",
		headers: {
			"Content-Type": "application/json"
		},
		body: JSON.stringify({
			type: 1,
			keyId: parseInt(vals[0]),
			id: parseInt(vals[1]),
		}),
	});
	if(res.status == 204) {
		this.parentElement.remove();
	} else {
		alert("Request Error: " + res.status.toString());
	}
}

async function invalidateKey() {
	const res = await fetch(frostMir + "/master", {
		method: "POST",
		headers: {
			"Content-Type": "application/json"
		},
		body: JSON.stringify({
			type: 2,
			ind: parseInt(this.value)
		}),
	});
	if(res.status == 204) {
		this.parentElement.remove();
	} else {
		alert("Request Error: " + res.status.toString());
	}
}

async function hash(msg) {
	const encoder = new TextEncoder();
	return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(msg)))).map(b => b.toString(16).padStart(2, '0')).join('');
}

function startMove(e) {
	moving = true;
	const bound = adminpanel.getBoundingClientRect();
	offsetx = e.clientX - bound.left;
	offsety = e.clientY - bound.top;
}

function stopMove() {
    moving = false;
}

function movePanel(e) {
	if(moving) {
		adminpanel.style.top = (e.clientY - offsety).toString() + "px";
		adminpanel.style.left = (e.clientX - offsetx).toString() + "px";
	}
}

adminheader.addEventListener('mousedown', startMove);
document.addEventListener('mouseup', stopMove);
document.addEventListener('mousemove', movePanel);
adminheader.addEventListener('touchstart', startMove);
document.addEventListener('touchend', stopMove);
document.addEventListener('touchmove', movePanel);

sessinp.addEventListener('input', () => {
	sessinp.value = Math.max(1, parseInt(sessinp.value));
});
keysub.addEventListener('click', async () => {
	if(keyinp.value.length == 0) {
		alert("No key entered!");
		return;
	}
	const res = await fetch(frostMir + "/master", {
		method: "POST",
		headers: {
			"Content-Type": "application/json"
		},
		body: JSON.stringify({
			type: 0,
			key: await hash(keyinp.value),
			maxsessions: parseInt(sessinp.value),
			name: keyNameInput.value,
			unlimit: !limchk.checked,
			master: mstchk.checked,
		}),
	});
	if(res.status == 200) {
		const nentry = document.createElement('div');
		nentry.className = 'item marbot';
		const invbtn = document.createElement('button');
		invbtn.className = 'pd-keyinvalid';
		invbtn.value = await res.text(); //parseInt(keylist[keylist.children.length-1].value)+1
		invbtn.appendChild(document.createTextNode("INVALIDATE"));
		nentry.appendChild(document.createTextNode(invbtn.value + " " + (mstchk.checked ? "MASTER" : "GUEST") + " SESSN:0 MAX:" + sessinp.value + (limchk.checked ? " LIMTD" : " UNLIM")));
		nentry.appendChild(invbtn);
		keylist.appendChild(nentry);
		invbtn.addEventListener('click', invalidateKey);
		keyinvalids = keylist.getElementsByClassName('pb-keyinvalid');
	} else {
		alert("Request Error: " + res.status.toString());
	}
});
for(let i = 0; i < sessionends.length; i++) {
	sessionends[i].addEventListener('click', endSessionReq);
}
for(let i = 0; i < keyinvalids.length; i++) {
	keyinvalids[i].addEventListener('click', invalidateKey);
}