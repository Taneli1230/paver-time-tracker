import React, { useState } from "react";

export default function LawnBillingScreen({
  card,
  btn,
  btnPrimary,
  goBack,
  billingData,
  billingMonth,
  setBillingMonth,
  onLoadBilling,
  onMarkBilled,
}) {
  const months = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString([], { month: "long", year: "numeric" });
    months.push({ value, label });
  }

  const grandTotal = billingData.reduce((sum, a) => sum + a.total, 0);
  const allBilled = billingData.length > 0 && billingData.every((a) => a.allBilled);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <button style={btn} onClick={goBack}>
        ← Back to Accounts
      </button>

      <div style={card}>
        <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 10 }}>
          Monthly Billing
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #d1d5db",
              fontSize: 16,
              flex: 1,
            }}
            value={billingMonth}
            onChange={(e) => setBillingMonth(e.target.value)}
          >
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>

          <button style={btnPrimary} onClick={onLoadBilling}>
            Load
          </button>
        </div>
      </div>

      {billingData.length === 0 ? (
        <div style={card}>
          <div style={{ color: "#6b7280" }}>
            No visits found for this month. Select a month and click Load.
          </div>
        </div>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
            }}
          >
            <div style={card}>
              <div style={{ color: "#6b7280", fontSize: 13 }}>
                Grand Total
              </div>
              <div style={{ fontWeight: 900, fontSize: 24 }}>
                ${grandTotal.toFixed(2)}
              </div>
            </div>
            <div style={card}>
              <div style={{ color: "#6b7280", fontSize: 13 }}>Accounts</div>
              <div style={{ fontWeight: 900, fontSize: 24 }}>
                {billingData.length}
              </div>
            </div>
          </div>

          {billingData.map((acct) => (
            <div key={acct.account_id} style={card}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                <div>
                  <div style={{ fontWeight: 900, fontSize: 16 }}>
                    {acct.name}
                  </div>
                  <div style={{ color: "#6b7280", fontSize: 13 }}>
                    {acct.address || "No address"}
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 900, fontSize: 18 }}>
                    ${acct.total.toFixed(2)}
                  </div>
                  {acct.allBilled ? (
                    <div
                      style={{
                        color: "#10b981",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      Billed
                    </div>
                  ) : (
                    <button
                      style={{
                        ...btn,
                        fontSize: 12,
                        padding: "6px 10px",
                      }}
                      onClick={() => onMarkBilled(acct.account_id, acct.visitIds)}
                    >
                      Mark Billed
                    </button>
                  )}
                </div>
              </div>

              <div style={{ marginBottom: 8, color: "#6b7280", fontSize: 13 }}>
                {acct.mowingCount} cut{acct.mowingCount !== 1 ? "s" : ""} ($
                {acct.mowingTotal.toFixed(2)})
                {acct.sprayCount > 0 &&
                  ` • ${acct.sprayCount} spray ($${acct.sprayTotal.toFixed(2)})`}
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                {acct.visits.map((v) => {
                  return (
                    <div
                      key={v.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto auto",
                        gap: 10,
                        padding: 8,
                        border: "1px solid #f3f4f6",
                        borderRadius: 10,
                        fontSize: 13,
                        alignItems: "center",
                      }}
                    >
                      <div>
                        {new Date(v.visit_date + "T12:00:00").toLocaleDateString(
                          [],
                          {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          }
                        )}
                      </div>
                      <div style={{ color: "#6b7280" }}>
                        {v.service_type} • {Number(v.total_minutes || 0).toFixed(0)} min
                      </div>
                      <div style={{ fontWeight: 800 }}>
                        ${v.charge.toFixed(2)}
                        {v.billed && (
                          <span
                            style={{
                              color: "#10b981",
                              marginLeft: 6,
                              fontSize: 11,
                            }}
                          >
                            ✓
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {!allBilled && (
            <button
              style={btnPrimary}
              onClick={() => {
                const allIds = billingData.flatMap((a) =>
                  a.visits.filter((v) => !v.billed).map((v) => v.id)
                );
                if (allIds.length === 0) return;
                onMarkBilled(null, allIds);
              }}
            >
              Mark All Billed (${grandTotal.toFixed(2)})
            </button>
          )}
        </>
      )}
    </div>
  );
}