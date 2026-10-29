/* WardrobeIQ — login & signup forms */
document.addEventListener("DOMContentLoaded", () => {
  const signupForm = document.querySelector("#signupForm");
  const loginForm = document.querySelector("#loginForm");
  const { toast } = window.WIQ;

  // Already logged in? Skip straight to the dashboard
  if (localStorage.getItem("token")) {
    window.location.replace("/dashboard");
    return;
  }

  // Show / hide password
  document.querySelectorAll(".toggle-pw").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = btn.parentElement.querySelector("input");
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
      btn.style.color = show ? "var(--peach)" : "";
    });
  });

  // Clear error state as the user types
  document.querySelectorAll(".field input").forEach((input) => {
    input.addEventListener("input", () => input.parentElement.classList.remove("invalid"));
  });

  function markInvalid(input) {
    const field = input.parentElement;
    field.classList.remove("invalid");
    void field.offsetWidth; // restart shake animation
    field.classList.add("invalid");
    input.focus();
  }

  function validate(inputs) {
    for (const input of inputs) {
      if (!input.checkValidity()) {
        markInvalid(input);
        const label = input.parentElement.querySelector("label").textContent;
        toast(input.validity.valueMissing ? `${label} is required` : `Please enter a valid ${label.toLowerCase()}`, "error");
        return false;
      }
    }
    return true;
  }

  async function submit(form, url, body) {
    const btn = form.querySelector('button[type="submit"]');
    btn.classList.add("loading");
    btn.disabled = true;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, data };
    } catch (err) {
      console.error(err);
      return { ok: false, data: { message: "Network error, please try again." } };
    } finally {
      btn.classList.remove("loading");
      btn.disabled = false;
    }
  }

  if (signupForm) {
    const pw = document.querySelector("#signupPassword");
    const meter = document.querySelector(".pw-meter span");
    const hint = document.querySelector("#pwHint");
    pw.addEventListener("input", () => {
      const v = pw.value;
      let score = 0;
      if (v.length >= 6) score++;
      if (v.length >= 10) score++;
      if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
      if (/\d/.test(v) && /[^A-Za-z0-9]/.test(v)) score++;
      const levels = [
        ["8%", "var(--danger)", "At least 6 characters"],
        ["30%", "var(--coral)", "Okay — longer is stronger"],
        ["55%", "var(--peach)", "Good"],
        ["80%", "var(--cyan)", "Strong"],
        ["100%", "var(--success)", "Excellent"],
      ];
      const [w, c, text] = v ? levels[score] : ["0%", "", "At least 6 characters"];
      meter.style.setProperty("--w", w);
      meter.style.setProperty("--c", c);
      hint.textContent = text;
    });

    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const nameEl = document.querySelector("#signupName");
      const emailEl = document.querySelector("#signupEmail");
      if (!validate([nameEl, emailEl, pw])) return;

      const { ok, data } = await submit(signupForm, "/api/auth/signup", {
        name: nameEl.value.trim(),
        email: emailEl.value.trim(),
        password: pw.value,
      });
      if (!ok) return toast(data.message || "Signup failed", "error");

      toast("Account created! Logging you in…", "success");
      // Log straight in so the user lands on their dashboard
      const login = await submit(signupForm, "/api/auth/login", { email: emailEl.value.trim(), password: pw.value });
      if (login.ok) {
        localStorage.setItem("token", login.data.token);
        setTimeout(() => (window.location.href = "/dashboard"), 700);
      } else {
        setTimeout(() => (window.location.href = "/login"), 900);
      }
    });
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const emailEl = document.querySelector("#loginEmail");
      const pwEl = document.querySelector("#loginPassword");
      if (!validate([emailEl, pwEl])) return;

      const { ok, data } = await submit(loginForm, "/api/auth/login", {
        email: emailEl.value.trim(),
        password: pwEl.value,
      });
      if (!ok) {
        markInvalid(pwEl);
        return toast(data.message || "Login failed", "error");
      }
      localStorage.setItem("token", data.token);
      toast("Welcome back!", "success");
      setTimeout(() => (window.location.href = "/dashboard"), 500);
    });
  }
});
