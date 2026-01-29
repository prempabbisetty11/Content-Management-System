var app = angular.module("cmsApp", []);

app.controller("CmsController", function ($scope, $http) {
  const API = window.location.origin;

  $scope.isLoggedIn = false;
  $scope.isAdmin = false;

  $scope.contents = [];
  $scope.content = {};
  $scope.departments = ["CSE", "ACSE", "ECE", "ALL"];
  $scope.selectedDepartments = [];

  // Keep ALL mutually exclusive with specific departments
  $scope.toggleDepartment = function (d) {
    if (d === "ALL") {
      $scope.selectedDepartments = ["ALL"];
      $scope.deptAll = true;
      return;
    }
    // selecting any specific clears ALL
    $scope.deptAll = false;
    const i = $scope.selectedDepartments.indexOf(d);
    if (i === -1) $scope.selectedDepartments.push(d);
    else $scope.selectedDepartments.splice(i, 1);
  };
  $scope.login = { type: "" };

  $scope.loginMessage = "";
  $scope.loginError = "";

  // menu + panels
  $scope.menuOpen = false;
  $scope.activePanel = "";
  $scope.users = [];

  // view logs
  $scope.viewLogsForContent = null;
  $scope.viewLogs = [];

  // new user form
  $scope.newUser = { role: "user" };
  $scope.newUserMsg = "";
  $scope.newUserErr = "";

  // ---------- UI helpers ----------
  $scope.toggleMenu = function () {
    $scope.menuOpen = !$scope.menuOpen;
  };

  $scope.openPanel = function (panel) {
    $scope.activePanel = panel;
    $scope.menuOpen = false;

    if (panel === "settings") {
      $scope.loadUsers();
      $scope.searchedUser = null;
      $scope.searchErr = "";
    }
  };

  $scope.closePanel = function () {
    $scope.activePanel = "";
  };

  $scope.logout = function () {
    $scope.isLoggedIn = false;
    $scope.isAdmin = false;
    $scope.user = null;
    $scope.contents = [];
    $scope.content = {};
    $scope.login = { type: "" };
    $scope.activePanel = "";
    $scope.menuOpen = false;
    $scope.viewLogsForContent = null;
    $scope.viewLogs = [];
  };

  // ---------- Login ----------
  $scope.loginUser = function () {
    $scope.loginMessage = "";
    $scope.loginError = "";

    if (!$scope.login.email || !$scope.login.password) {
      $scope.loginError = "Enter email and password";
      return;
    }

    $http
      .post(API + "/login", { email: $scope.login.email, password: $scope.login.password })
      .then((res) => {
        $scope.user = res.data;
        $scope.isAdmin = res.data.role === "admin";
        $scope.user.department = res.data.department || "ALL";
        $scope.isLoggedIn = true;
        $scope.loginMessage = "Login successful";
        $scope.fetchContents();
        setTimeout(() => $scope.fetchContents(), 300);
      })
      .catch((err) => {
        if (err && err.data) $scope.loginError = String(err.data);
        else $scope.loginError = "Invalid email or password";
      });
  };

  // ---------- Content ----------
  $scope.fetchContents = function () {
    if (!$scope.user) return;

    $http.get(API + "/content", {
      params: {
        email: $scope.user.email,
        department: $scope.user.department
      }
    }).then((res) => {
      $scope.contents = res.data;
    });
  };

  // ---------- View count helper ----------
  $scope.getViewCount = function (c) {
    return c && typeof c.view_count === "number" ? c.view_count : 0;
  };

  $scope.saveContent = function () {
    if (!$scope.isAdmin) return;

    let fd = new FormData();
    fd.append("title", $scope.content.title || "");
    fd.append("body", $scope.content.body || "");
    fd.append("author", $scope.user.email);
    const deptPayload =
      $scope.selectedDepartments && $scope.selectedDepartments.length
        ? $scope.selectedDepartments.join(",")
        : "ALL";

    fd.append("departments", deptPayload);

    const fileEl = document.getElementById("media");
    if (fileEl && fileEl.files && fileEl.files[0]) fd.append("media", fileEl.files[0]);

    $http
      .post(API + "/content", fd, { headers: { "Content-Type": undefined } })
      .then(() => {
        $scope.content = {};
        if (fileEl) fileEl.value = "";
        $scope.selectedDepartments = [];
        $scope.deptAll = false;
        $scope.fetchContents();
      })
      .catch((e) => alert("Upload/Publish failed: " + (e.data || "")));
  };

  $scope.editContent = function (item) {
    $scope.content = angular.copy(item);
  };

  $scope.updateContent = function () {
    $http
      .put(API + "/content/" + $scope.content.id, {
        title: $scope.content.title,
        body: $scope.content.body,
        author: $scope.user.email
      })
      .then(() => {
        $scope.content = {};
        $scope.fetchContents();
      });
  };

  $scope.deleteContent = function (id) {
    $http
      .delete(API + "/content/" + id, {
        data: { author: $scope.user.email },
        headers: { "Content-Type": "application/json" }
      })
      .then(() => $scope.fetchContents());
  };

  // ---------- Media helpers ----------
  $scope.mediaUrl = function (filename) {
    return API + "/uploads/" + filename;
  };

  function ext(name) {
    if (!name) return "";
    const i = name.lastIndexOf(".");
    return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
  }

  $scope.isImage = function (filename) {
    const e = ext(filename);
    return ["png", "jpg", "jpeg", "gif", "webp"].includes(e);
  };

  $scope.isVideo = function (filename) {
    const e = ext(filename);
    return ["mp4", "webm", "mov", "mkv"].includes(e);
  };

  $scope.isAudio = function (filename) {
    const e = ext(filename);
    return ["mp3", "wav", "ogg", "m4a"].includes(e);
  };

  $scope.isPDF = function (filename) {
    return filename && filename.toLowerCase().endsWith(".pdf");
  };

  $scope.isExcel = function (filename) {
    return (
      filename &&
      (filename.toLowerCase().endsWith(".xls") ||
       filename.toLowerCase().endsWith(".xlsx"))
    );
  };

  $scope.openMedia = function (c) {
    if (!c || !c.media) return;

    // log view
    $scope.logView(c.id);

    // open media
    window.open($scope.mediaUrl(c.media), "_blank");

    // refresh counts shortly after
    setTimeout(() => $scope.fetchContents(), 400);
  };

  // ---------- View logging ----------
  $scope.logView = function (contentId) {
    if (!$scope.user || !contentId) return;

    $http.post(API + "/content/" + contentId + "/view", {
      viewer_email: $scope.user.email
    });
  };

  $scope.showViews = function (content) {
    if (!$scope.isAdmin) return;

    // ensure a view is logged when details are opened
    if (!$scope.isAdmin) {
      $scope.logView(content.id);
    }

    $scope.viewLogsForContent = content;
    $scope.viewLogs = [];

    $http
      .get(API + "/content/" + content.id + "/views", { params: { admin: $scope.user.email } })
      .then((res) => {
        $scope.viewLogs = res.data;
      })
      .catch(() => {
        $scope.viewLogs = [];
      });
  };

  $scope.closeViews = function () {
    $scope.viewLogsForContent = null;
    $scope.viewLogs = [];
  };

  // ---------- Users admin ----------
  $scope.loadUsers = function () {
    if (!$scope.isAdmin) return;

    $http
      .get(API + "/users", { params: { admin: $scope.user.email } })
      .then((res) => {
        $scope.users = res.data;
        $scope.searchedUser = null;
        $scope.searchErr = "";
      })
      .catch(() => {
        $scope.users = [];
      });
  };

  $scope.updateUser = function (u) {
    if (!$scope.isAdmin) return;

    $http
      .put(API + "/users/" + u.id, {
        admin: $scope.user.email,
        newUsername: u.newUsername || "",
        newPassword: u.newPassword || ""
      })
      .then(() => {
        u.newUsername = "";
        u.newPassword = "";
        $scope.loadUsers();
      })
      .catch((e) => alert("Update failed: " + (e.data || "")));
  };

  $scope.blockUser = function (u) {
    if (!$scope.isAdmin) return;

    $http
      .post(API + "/users/" + u.id + "/block", {
        admin: $scope.user.email,
        minutes: u.blockMinutes || 0
      })
      .then(() => $scope.loadUsers())
      .catch((e) => alert("Block failed: " + (e.data || "")));
  };

  $scope.unblockUser = function (u) {
    if (!$scope.isAdmin) return;

    $http
      .post(API + "/users/" + u.id + "/unblock", {
        admin: $scope.user.email
      })
      .then(() => $scope.loadUsers())
      .catch((e) => alert("Unblock failed: " + (e.data || "")));
  };

  $scope.createUser = function () {
    if (!$scope.isAdmin) return;

    $scope.newUserMsg = "";
    $scope.newUserErr = "";

    if (!$scope.newUser.id || !$scope.newUser.email || !$scope.newUser.password || !$scope.newUser.role) {
      $scope.newUserErr = "Fill ID, Email, Password, Role";
      return;
    }

    $scope.newUser.department = $scope.newUser.department || "CSE";

    $http
      .post(API + "/users", {
        admin: $scope.user.email,
        id: $scope.newUser.id,
        email: $scope.newUser.email,
        password: $scope.newUser.password,
        role: $scope.newUser.role,
        username: $scope.newUser.username || $scope.newUser.id,
        department: $scope.newUser.department
      })
      .then(() => {
        $scope.newUserMsg = "User created";
        $scope.newUser = { role: "user" };
        $scope.loadUsers();
      })
      .catch((e) => {
        $scope.newUserErr = e && e.data ? String(e.data) : "Create failed";
      });
  };

  $scope.searchUser = function () {
    if (!$scope.isAdmin) return;

    $scope.searchedUser = null;
    $scope.searchErr = "";

    if (!$scope.searchUserId) {
      $scope.searchErr = "Enter User ID";
      return;
    }

    $http
      .get(API + "/users/search", {
        params: {
          admin: $scope.user.email,
          id: $scope.searchUserId.trim()
        }
      })
      .then((res) => {
        if (res.data) {
          $scope.searchedUser = res.data;
          $scope.activePanel = "settings";
        } else {
          $scope.searchErr = "No user found";
        }
      })
      .catch(() => {
        $scope.searchErr = "Search failed";
      });
  };
});

// ===== Live mouse glow background =====
document.addEventListener("mousemove", (e) => {
  const x = (e.clientX / window.innerWidth) * 100;
  const y = (e.clientY / window.innerHeight) * 100;
  document.documentElement.style.setProperty("--mx", x + "%");
  document.documentElement.style.setProperty("--my", y + "%");
});

// =========================
// Cool Custom Cursor (Glow Ring + Dot)
// =========================
(function () {
  // Create cursor elements once
  const ring = document.createElement("div");
  ring.id = "cool-cursor";
  document.body.appendChild(ring);

  const dot = document.createElement("div");
  dot.id = "cool-dot";
  document.body.appendChild(dot);

  let mx = window.innerWidth / 2;
  let my = window.innerHeight / 2;

  // Smooth follow for ring
  let rx = mx, ry = my;

  function raf() {
    // ring follows smoothly
    rx += (mx - rx) * 0.18;
    ry += (my - ry) * 0.18;

    ring.style.top = ry + "px";
    ring.style.left = rx + "px";

    // dot follows faster (snappy)
    dot.style.top = my + "px";
    dot.style.left = mx + "px";

    requestAnimationFrame(raf);
  }
  raf();

  // Track mouse and show cursor
  document.addEventListener("mousemove", (e) => {
    mx = e.clientX;
    my = e.clientY;

    document.body.classList.remove("cursor-hide");
    ring.style.opacity = "1";
    dot.style.opacity = "1";
  });

  // Hide cursor when leaving page
  document.addEventListener("mouseleave", () => {
    document.body.classList.add("cursor-hide");
  });

  // Add hover effect on interactive elements
  const hoverSelector = "button, a, input, textarea, select, label";
  document.addEventListener("mouseover", (e) => {
    if (e.target.closest(hoverSelector)) document.body.classList.add("cursor-hover");
  });
  document.addEventListener("mouseout", (e) => {
    if (e.target.closest(hoverSelector)) document.body.classList.remove("cursor-hover");
  });
})();