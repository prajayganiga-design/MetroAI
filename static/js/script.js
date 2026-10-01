const splash = document.getElementById("splash-screen");
const dashboard = document.getElementById("dashboard");

setTimeout(() => {

    splash.style.opacity = "0";
    splash.style.transition = "0.8s";

    setTimeout(() => {

        splash.style.display = "none";
        dashboard.style.display = "flex";

    },800);

},3500);