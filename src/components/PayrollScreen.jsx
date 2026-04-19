import React from "react";

function shortUserId(userId) {
  if (!userId) return "Unknown";
  return userId.slice(0, 8);
}

export default function PayrollScreen({
  card,
  btn,
  input,
  goJobs,
  payrollLoading,
  payrollRows,
  weeklyPayrollRows,
  payrollWeekDates,
  payrollWeekOffset,
  payrollShiftRows,
  openPayroll,
  editPayrollShift,
}) {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <button style={btn} onClick={goJobs}>
        ← Back to Jobs
      </button>

      {payrollLoading ? (
        <div style={card}>Loading payroll...</div>
      ) : (
        <>
          <div style={card}>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>
              Current Payroll Status
            </div>

            {payrollRows.length === 0 ? (
              <div style={{ color: "#6b7280" }}>
                No one is currently clocked in.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {payrollRows.map((row) => (
                  <div
                    key={row.id}
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
                        {String(row.display_name || "").trim() || `Worker ${shortUserId(row.user_id)}`}
                      </div>
                      <div style={{ color: "#6b7280", fontSize: 13 }}>
                        {row.status === "on_break"
                          ? "On Lunch"
                          : "Clocked In"}
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 800 }}>
                        {new Date(row.clock_in_at).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={card}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
                marginBottom: 10,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={{ fontWeight: 900 }}>Weekly Payroll Totals</div>
                <div style={{ color: "#6b7280", fontSize: 13 }}>
                  {payrollWeekDates[0]} to {payrollWeekDates[6]}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  style={btn}
                  onClick={() => openPayroll(payrollWeekOffset + 1)}
                >
                  ← Previous Week
                </button>

                <button
                  style={btn}
                  onClick={() => openPayroll(Math.max(0, payrollWeekOffset - 1))}
                  disabled={payrollWeekOffset === 0}
                >
                  Next Week →
                </button>
              </div>
            </div>

            <div style={card}>
              <div style={{ fontWeight: 900, marginBottom: 10 }}>
                Payroll Shift Corrections
              </div>

              {payrollShiftRows.length === 0 ? (
                <div style={{ color: "#6b7280" }}>No payroll shifts found this week.</div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {payrollShiftRows.map((row) => (
                    <div
                      key={row.id}
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
                          {row.display_name || `Worker ${shortUserId(row.user_id)}`}
                        </div>
                        <div style={{ color: "#6b7280", fontSize: 13 }}>
                          {row.work_date} • {row.status}
                        </div>
                        <div style={{ color: "#6b7280", fontSize: 13 }}>
                          In: {row.clock_in_at ? new Date(row.clock_in_at).toLocaleString() : "—"} •
                          Out: {row.clock_out_at ? new Date(row.clock_out_at).toLocaleString() : "—"}
                        </div>
                        <div style={{ color: "#6b7280", fontSize: 13 }}>
                          {(Number(row.total_work_minutes || 0) / 60).toFixed(2)} hrs
                        </div>
                      </div>

                      <button style={btn} onClick={() => editPayrollShift(row)}>
                        Edit
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {weeklyPayrollRows.length === 0 ? (
              <div style={{ color: "#6b7280" }}>
                No payroll shifts found this week.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.4fr repeat(7, 1fr) 1fr",
                    gap: 8,
                    fontWeight: 800,
                    fontSize: 12,
                    color: "#6b7280",
                    paddingBottom: 6,
                  }}
                >
                  <div>Worker</div>
                  {payrollWeekDates.map((d) => (
                    <div key={d}>
                      {new Date(`${d}T12:00:00`).toLocaleDateString([], {
                        weekday: "short",
                      })}
                    </div>
                  ))}
                  <div>Total</div>
                </div>

                {weeklyPayrollRows.map((row) => (
                  <div
                    key={row.user_id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.4fr repeat(7, 1fr) 1fr",
                      gap: 8,
                      padding: 10,
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      background: "white",
                      alignItems: "center",
                      fontSize: 13,
                    }}
                  >
                    <div style={{ fontWeight: 800 }}>
                      {String(row.display_name || "").trim() || `Worker ${shortUserId(row.user_id)}`}
                    </div>

                    {payrollWeekDates.map((d) => (
                      <div key={d}>
                        {(Number(row.days[d] || 0) / 60).toFixed(2)}
                      </div>
                    ))}

                    <div style={{ fontWeight: 900 }}>
                      {(Number(row.total_minutes || 0) / 60).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}