import React, { useState } from "react";
import { supabase } from "../supabaseClient";

export default function LoginScreen({ card, input, btn, btnPrimary, fontFamily }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh" }}>
      <div
        style={{
          maxWidth: 520,
          margin: "0 auto",
          padding: 24,
          fontFamily,
        }}
      >
        <div style={{ ...card, textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 6 }}>
            Login to Time Tracker
          </div>
          <div style={{ color: "#6b7280", marginBottom: 14 }}>
            Enter your email and password to sign in.
          </div>

          <input
            style={input}
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <div style={{ height: 10 }} />

          <input
            style={input}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <div style={{ height: 10 }} />

          <button
            style={btnPrimary}
            onClick={async () => {
              if (!email.trim() || !password) {
                return alert("Enter email + password.");
              }

              const { error } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password,
              });

              if (error) return alert(error.message);
            }}
          >
            Sign In
          </button>

          <div style={{ height: 10 }} />

          <button
            style={btn}
            onClick={async () => {
              if (!email.trim() || !password) {
                return alert("Enter email + password.");
              }

              const { error } = await supabase.auth.signUp({
                email: email.trim(),
                password,
              });

              if (error) return alert(error.message);
              alert("Account created. You can now sign in.");
            }}
          >
            Create Account
          </button>
        </div>
      </div>
    </div>
  );
}