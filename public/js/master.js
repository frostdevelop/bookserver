const adminpanel = document.getElementById('pb-AdminPanel');
const adminheader = adminpanel.getElementsByClassName('header')[0];
const keyinp = document.getElementById('pb-kc-ncinp');
const sessinp = document.getElementById('pb-kc-maxinp');
const keyNameInput = document.getElementById('pb-kc-keyName');
const keyConfirmInput = document.getElementById('pb-kc-keyConfirm');
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

// Master panel should be replaced with a form-based system

async function endSessionReq() {
	const res = await fetch(frostMir + "/master", {
		method: "POST",
		headers: {
			"Content-Type": "application/json"
		},
		body: JSON.stringify({
			type: 1,
			id: parseInt(this.value),
		}),
	});
	if(res.status == 204) {
		showSuccess("Session ended.");
		this.parentElement.remove();
	} else {
		showAlert("Ending Session Error: " + res.status.toString());
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
			name: this.value,
		}),
	});
	if(res.status == 204) {
		showSuccess("Key invalidated.");
		this.parentElement.remove();
	} else {
		showAlert("Invalidation Error: " + res.status.toString());
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
	if(keyNameInput.value.length == 0) {
        showAlert("No key name entered!");
        return;
    }else if(keyinp.value.length < 8) {
		showAlert("Key must be at least 8 characters long!");
		return;
	}else if (keyinp.value != keyConfirmInput.value){
		showAlert("The keys don't match :(");
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
	if(res.status == 204) {
		showSuccess("Key successfully created.");
		const nentry = document.createElement('div');
		nentry.className = 'item marbot';
		const invbtn = document.createElement('button');
		invbtn.className = 'pd-keyinvalid';
		invbtn.value = keyNameInput.value;
		invbtn.appendChild(document.createTextNode("INVALIDATE"));
		const keyText = document.createElement('span');
		keyText.innerText = `[${keyNameInput.value}]\n0/${sessinp.value} ${limchk.checked ? "Uses" : "Sessions"}`;
		nentry.appendChild(keyText);
		if(mstchk.checked){
			const adminIcon = document.createElement('span');
			adminIcon.title = "This user is an admin.";
			adminIcon.classList.add('icon-admin');
			nentry.appendChild(adminIcon);
		}
		nentry.appendChild(invbtn);
		keylist.appendChild(nentry);
		invbtn.addEventListener('click', invalidateKey);
	} else {
		showAlert("Key Creation Error! The key already exists.");
	}
});
for(let i = 0; i < sessionends.length; i++) {
	sessionends[i].addEventListener('click', endSessionReq);
}
for(let i = 0; i < keyinvalids.length; i++) {
	keyinvalids[i].addEventListener('click', invalidateKey);
}