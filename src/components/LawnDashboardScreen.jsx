import React from "react";

export default function LawnDashboardScreen({
  card,
  btn,
  goBack,
  activeTimers,
  monthlyStats,
  accountProfitability,
  recentVisits,
  tick,
}) {
  function fmtClock(ms) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const hh = String(Math.floor(totalSec / 3600)).padStart(2, "0");
    const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
    const ss = String(totalSec % 60).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <button style={btn} onClick={goBack}>
        ← Back to Accounts
      </button>

      <div style={card}>
        <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 10 }}>
          Lawn Care Dashboard
        </div>
      </div>

      {/* Active Timers */}
      <div style={card}>
        <div style={{ fontWeight: 900, marginBottom: 10 }}>
          Currently Working
        </div>

        {activeTimers.length === 0 ? (
          <div style={{ color: "#6b7280" }}>
            No one is currently running a lawn timer.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {activeTimers.map((t) => {
              const elapsedMs = tick - new Date(t.started_at).getTime();

              return (
                <div
                  key={t.worker_id}
                  style={{
                    padding: 10,
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    background: "white",
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800 }}>
                      {t.display_name || "Worker"} — {t.account_name || "Account"}
                    </div>
                    <div style={{ color: "#6b7280", fontSize: 13 }}>
                      {t.service_type}
                    </div>
                  </div>
                  <div style={{ fontWeight: 900 }}>
                    {fmtClock(elapsedMs)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Monthly Revenue */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        <div style={card}>
          <div style={{ color: "#6b7280", fontSize: 13 }}>This Month Revenue</div>
          <div style={{ fontWeight: 900, fontSize: 24 }}>
            ${monthlyStats.totalRevenue.toFixed(2)}
          </div>
        </div>
        <div style={card}>
          <div style={{ color: "#6b7280", fontSize: 13 }}>Billed</div>
          <div style={{ fontWeight: 900, fontSize: 24, color: "#10b981" }}>
            ${monthlyStats.billedRevenue.toFixed(2)}
          </div>
        </div>
        <div style={card}>
          <div style={{ color: "#6b7280", fontSize: 13 }}>Unbilled</div>
          <div style={{ fontWeight: 900, fontSize: 24, color: "#dc2626" }}>
            ${monthlyStats.unbilledRevenue.toFixed(2)}
          </div>
        </div>
        <div style={card}>
          <div style={{ color: "#6b7280", fontSize: 13 }}>Visits This Month</div>
          <div style={{ fontWeight: 900, fontSize: 24 }}>
            {monthlyStats.visitCount}
          </div>
        </div>
      </div>

      {/* Account Profitability */}
      <div style={card}>
        <div style={{ fontWeight: 900, marginBottom: 10 }}>
          Account Profitability
        </div>

        {accountProfitability.length === 0 ? (
          <div style={{ color: "#6b7280" }}>No account data yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {accountProfitability.map((a) => (
              <div
                key={a.account_id}
                style={{
                  padding: 10,
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  background: "white",
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ fontWeight: 800 }}>{a.name}</div>
                    <div
                      style={{
                        padding: "2px 8px",
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 700,
                        background:
                          a.effectiveHourlyRate >= 45
                            ? "#dcfce7"
                            : a.effectiveHourlyRate >= 35
                            ? "#fef9c3"
                            : "#fee2e2",
                        color:
                          a.effectiveHourlyRate >= 45
                            ? "#166534"
                            : a.effectiveHourlyRate >= 35
                            ? "#854d0e"
                            : "#991b1b",
                      }}
                    >
                      {a.effectiveHourlyRate >= 45
                        ? "Profitable"
                        : a.effectiveHourlyRate >= 35
                        ? "Break Even"
                        : "Under Target"}
                    </div>
                  </div>
                  <div style={{ color: "#6b7280", fontSize: 13 }}>
                    {a.address || "No address"} • {a.visitCount} visit{a.visitCount !== 1 ? "s" : ""} • Avg {a.avgMinutes.toFixed(0)} min/cut
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 900 }}>
                    ${a.effectiveHourlyRate.toFixed(2)}/hr
                  </div>
                  <div style={{ color: "#6b7280", fontSize: 13 }}>
                    ${a.totalRevenue.toFixed(2)} revenue
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Visits */}
      <div style={card}>
        <div style={{ fontWeight: 900, marginBottom: 10 }}>
          Recent Visits (Last 7 Days)
        </div>

        {recentVisits.length === 0 ? (
          <div style={{ color: "#6b7280" }}>No recent visits.</div>
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            {recentVisits.map((v) => (
              <div
                key={v.id}
                style={{
                  padding: 8,
                  border: "1px solid #f3f4f6",
                  borderRadius: 10,
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 10,
                  alignItems: "center",
                  fontSize: 13,
                }}
              >
                <div>
                  <span style={{ fontWeight: 700 }}>{v.account_name}</span>
                  {" — "}
                  {v.service_type} • {Number(v.total_minutes || 0).toFixed(0)} min
                  {v.worker_name && (
                    <span style={{ color: "#6b7280" }}> • {v.worker_name}</span>
                  )}
                </div>
                <div style={{ color: "#6b7280" }}>
                  {new Date(v.visit_date + "T12:00:00").toLocaleDateString([], {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}