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