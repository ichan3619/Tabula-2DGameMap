function logout() {

    // Remove client-side data
    localStorage.clear();

    // Destroy the PHP session
    const currentPath = window.location.pathname;

    if (currentPath.includes("/admin/")) {
        window.location.href = "../php/logout.php";
    } else {
        window.location.href = "php/logout.php";
    }
}

function checkAdminAccess() {
    const userRole = localStorage.getItem("userRole");

    if (
        userRole !== "admin" &&
        userRole !== "superadmin"
    ) {
        alert("Access Denied!");
        window.location.replace("../index.html");
    }
}