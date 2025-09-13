// src/utils/authFetch.js
export default async function authFetch(url, options = {}) {
  const token = localStorage.getItem("token"); // token from login

  const headers = {
    ...(options.headers || {}),
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    alert("Login required!");
    window.location.href = "/login";
    return;
  }

  return res.json();
}
