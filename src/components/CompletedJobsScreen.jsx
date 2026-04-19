import React from "react";

export default function CompletedJobsScreen({
  card,
  btn,
  goJobs,
  completedJobs,
  openCompletedJobReport,
}) {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <button style={btn} onClick={goJobs}>
        ← Back to Jobs
      </button>

      <div style={card}>
        <div style={{ fontWeight: 900, marginBottom: 10 }}>
          Completed Jobs
        </div>

        {completedJobs.length === 0 ? (
          <div style={{ color: "#6b7280" }}>No completed jobs yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {completedJobs.map((j) => {
              const totalM = Number(j.total_minutes) || 0;
              const totalH = totalM / 60;
              const mpsf = j.sqft > 0 ? totalM / j.sqft : 0;

              return (
                <div
                  key={j.job_id || j.id}
                  onClick={() => openCompletedJobReport(j)}
                  style={{
                    padding: 12,
                    borderRadius: 14,
                    border: "1px solid #e5e7eb",
                    background: "white",
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 10,
                    alignItems: "center",
                    cursor: "pointer",
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
                    <div style={{ color: "#6b7280", fontSize: 13 }}>
                      {totalH.toFixed(2)} hrs • {mpsf.toFixed(2)} min/sqft
                    </div>
                    <div style={{ color: "#6b7280", fontSize: 12 }}>
                      Completed {new Date(j.completed_at).toLocaleString()}
                    </div>
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