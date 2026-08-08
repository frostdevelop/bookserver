const timeComponents = document.getElementsByClassName("timeComponent");
function updateTimeComponents() {
    for (let i = 0; i < timeComponents.length; i++) {
        const component = timeComponents[i];
        const expiryTime = parseInt(component.getAttribute("data-expiry-time"));
        const timeDiff = expiryTime - Date.now();
        if (timeDiff <= 0) {
            component.innerText = "Expired";
        } else {
            component.innerText = `${(timeDiff / 60000).toFixed(0)}m ${((timeDiff % 60000) / 1000).toFixed(0)}s`;
        }
    }
}
setInterval(updateTimeComponents, 1000);

const alertContainer = document.getElementsByClassName("alertMsg")[0];
const alertMessage = alertContainer.getElementsByClassName("alertMsg_Msg")[0];
alertContainer.addEventListener("click", () => {
    alertContainer.classList.remove("visible");
});

let alertTimeout;
function showAlert(msg){
    alertContainer.classList.add("visible");
    alertMessage.innerText = msg;

    alertTimeout && clearTimeout(alertTimeout);
    alertTimeout = setTimeout(() => {
        alert.classList.remove("visible");
    }, 10000);
}

function showSuccess(msg){
    alertContainer.classList.add("visible");
    alertContainer.classList.add("success");
    alertMessage.innerText = msg;
    setTimeout(() => {
        alertContainer.classList.remove("visible");
        setTimeout(()=>alertContainer.classList.remove("success"),1000)
    }, 10000);
}

function showSuccessOnReload(msg){
    window.location.search = `?alert=${encodeURIComponent(msg)}&success=1`;
}

function showAlertOnReload(msg){
    window.location.search = `?alert=${encodeURIComponent(msg)}`;
}

const url = new URL(window.location.href);
const message = url.searchParams.get("alert");
if(message){
    if(url.searchParams.has("success")){
        showSuccess(message);
    }else{
        showAlert(message);
    }
}
url.search = '';
window.history.replaceState({},'',url);