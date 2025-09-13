document.addEventListener("DOMContentLoaded", () => {
  const signupForm = document.querySelector("#signupForm");
  const loginForm = document.querySelector("#loginForm");

  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = document.querySelector("#signupName").value.trim();
      const email = document.querySelector("#signupEmail").value.trim();
      const password = document.querySelector("#signupPassword").value;

      try {
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });
        const data = await res.json();

        if (res.ok) {
          alert(data.message);
          signupForm.reset();
          window.location.href = "login.html"; // redirect after signup
        } else {
          alert("Error: " + data.message);
        }
      } catch (err) {
        alert("Network error, please try again later.");
        console.error(err);
      }
    });
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = document.querySelector("#loginEmail").value.trim();
      const password = document.querySelector("#loginPassword").value;

      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();

        if (res.ok) {
          alert(data.message);
          localStorage.setItem("token", data.token);
          loginForm.reset();
            window.location.href = "dashboard.html";
        } else {
          alert("Error: " + data.message);
        }
      } catch (err) {
        alert("Network error, please try again later.");
        console.error(err);
      }
    });
  }
});
