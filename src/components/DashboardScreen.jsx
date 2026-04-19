import React from "react";

function fmtClock(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(totalSec / 3600)).padStart(2, "0");
  const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export default function DashboardScreen({
  card,
  btn,
  goJobs,
  dashboardRows,
  jobProgressRows,
  jobActivityRows,
  tick,
  supervisorStopTimer,
}) {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <button style={btn} onClick={goJobs}>
        ← Back to Jobs
      </button>

      <div style={card}>
        <div style={{ fontWeight: 900, marginBottom: 10 }}>
          Job Progress
        </div>

        {jobProgressRows.length === 0 ? (
          <div style={{ color: "#6b7280" }}>No jobs in progress yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {jobProgressRows.map((j) => {
              const activityBreakdown = jobActivityRows.filter(
                (a) => a.job_id === j.job_id
              );

              return (
                <div
                  key={j.job_id}
                  style={{
                    padding: 12,
                    borderRadius: 14,
                    border: "1px solid #e5e7eb",
                    background: "white",
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: 10,
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 900, color: "#111827" }}>
                        {j.name}
                      </div>
                      <div style={{ color: "#6b7280", fontSize: 13 }}>
                        Patio: {Number(j.patio_sqft || 0)} sqft • Wall:{" "}
                        {Number(j.wall_sqft || 0)} sqft • Cap:{" "}
                        {Number(j.cap_lf || 0)} lf
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 900, color: "#111827" }}>
                        {Number(j.total_hours || 0).toFixed(2)} hrs
                      </div>
                      <div style={{ color: "#6b7280", fontSize: 13 }}>
                        {Number(j.min_per_sqft || 0).toFixed(2)} min/sqft
                      </div>
                    </div>
                  </div>

                  {activityBreakdown.length > 0 && (
                    <div style={{ display: "grid", gap: 4 }}>
                      <div
                        style={{
                          fontWeight: 800,
                          color: "#111827",
                          fontSize: 13,
                        }}
                      >
                        Breakdown
                      </div>

                      {activityBreakdown.map((a) => (
                        <div
                          key={`${a.job_id}-${a.activity}`}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr auto",
                            gap: 10,
                            fontSize: 13,
                          }}
                        >
                          <div style={{ color: "#6b7280" }}>{a.activity}</div>
                          <div style={{ color: "#111827", fontWeight: 700 }}>
                            {Number(a.total_hours || 0).toFixed(2)} hrs
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={card}>
        <div style={{ fontWeight: 900 }}>Supervisor Dashboard</div>

        <div style={{ height: 10 }} />

        {dashboardRows.length === 0 ? (
          <div style={{ color: "#6b7280" }}>
            No one is currently running a timer.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {dashboardRows.map((r) => {
              const startedMs = new Date(r.started_at).getTime();
              const elapsedMs = tick - startedMs;

              return (
                <div
                  key={`${r.worker_id}-${r.job_id}-${r.started_at}`}
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
                    <div style={{ fontWeight: 900, color: "#111827" }}>
                      {r.display_name || "Worker"} — {r.job_name || "Job"}
                    </div>
                    <div style={{ color: "#6b7280", fontSize: 13 }}>
                      {r.activity}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gap: 8,
                      justifyItems: "end",
                    }}
                  >
                    <div style={{ fontWeight: 900, color: "#111827" }}>
                      {fmtClock(elapsedMs)}
                    </div>

                    <button
                      style={btn}
                      onClick={() => supervisorStopTimer(r)}
                    >
                      Stop Timer
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}