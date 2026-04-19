import React, { useState } from "react";

export default function LawnAccountsScreen({
  card,
  input,
  btn,
  btnPrimary,
  accounts,
  onAddAccount,
  onOpenAccount,
}) {
  const [newAccount, setNewAccount] = useState({
    name: "",
    address: "",
    cut_price: "",
    spray_rate_per_min: "",
    frequency: "weekly",
    sqft: "",
    notes: "",
  });

  function handleAdd() {
    if (!newAccount.name.trim()) {
      alert("Enter an account name.");
      return;
    }
    onAddAccount(newAccount);
    setNewAccount({
      name: "",
      address: "",
      cut_price: "",
      spray_rate_per_min: "",
      frequency: "weekly",
      sqft: "",
      notes: "",
    });
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={card}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>New Account</div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            marginBottom: 10,
          }}
        >
          <input
            style={input}
            placeholder="Account / Property Name"
            value={newAccount.name}
            onChange={(e) =>
              setNewAccount((s) => ({ ...s, name: e.target.value }))
            }
          />
          <input
            style={input}
            placeholder="Address"
            value={newAccount.address}
            onChange={(e) =>
              setNewAccount((s) => ({ ...s, address: e.target.value }))
            }
          />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr 1fr",
            gap: 10,
            marginBottom: 10,
          }}
        >
          <input
            style={input}
            placeholder="Cut Price ($)"
            inputMode="decimal"
            value={newAccount.cut_price}
            onChange={(e) =>
              setNewAccount((s) => ({ ...s, cut_price: e.target.value }))
            }
          />
          <input
  style={input}
  placeholder="Spray $/min (default 2)"
  inputMode="decimal"
  value={newAccount.spray_rate_per_min}
  onChange={(e) =>
    setNewAccount((s) => ({ ...s, spray_rate_per_min: e.target.value }))
  }
/>
          <select
            style={input}
            value={newAccount.frequency}
            onChange={(e) =>
              setNewAccount((s) => ({ ...s, frequency: e.target.value }))
            }
          >
            <option value="weekly">Weekly</option>
            <option value="biweekly">Biweekly</option>
            <option value="as_needed">As Needed</option>
          </select>
          <input
            style={input}
            placeholder="Sqft"
            inputMode="decimal"
            value={newAccount.sqft}
            onChange={(e) =>
              setNewAccount((s) => ({ ...s, sqft: e.target.value }))
            }
          />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 130px",
            gap: 10,
          }}
        >
          <input
            style={input}
            placeholder="Notes (optional)"
            value={newAccount.notes}
            onChange={(e) =>
              setNewAccount((s) => ({ ...s, notes: e.target.value }))
            }
          />
          <button style={btnPrimary} onClick={handleAdd}>
            Add
          </button>
        </div>
      </div>

      <div style={card}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 10,
          }}
        >
          <div style={{ fontWeight: 800 }}>Accounts</div>
          <div style={{ color: "#6b7280", fontSize: 13 }}>
            {accounts.length} total
          </div>
        </div>

        <div style={{ height: 10 }} />

        {accounts.length === 0 ? (
          <div style={{ color: "#6b7280" }}>
            No accounts yet. Add your first account above.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {accounts.map((a) => (
              <div
                key={a.id}
                style={{
                  padding: 12,
                  borderRadius: 14,
                  border: "1px solid #e5e7eb",
                  background: "white",
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontWeight: 800 }}>{a.name}</div>
                  <div style={{ color: "#6b7280", fontSize: 13 }}>
                    {a.address || "No address"}
                  </div>
                  <div style={{ color: "#6b7280", fontSize: 13 }}>
                    ${Number(a.cut_price || 0).toFixed(2)}/cut
                 {` • $${Number(a.spray_rate_per_min || 2).toFixed(2)}/min spray`}
                    {" • "}
                    {a.frequency}
                    {Number(a.sqft || 0) > 0 && ` • ${a.sqft} sqft`}
                  </div>
                </div>

                <button style={btnPrimary} onClick={() => onOpenAccount(a.id)}>
                  Open
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}