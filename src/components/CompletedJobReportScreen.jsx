import React from "react";

export default function CompletedJobReportScreen({
  card,
  btn,
  completedJobReport,
  completedJobActivities,
  completedJobNotes,
  openCompletedJobs,
}) {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <button style={btn} onClick={openCompletedJobs}>
        ← Back to Completed Jobs
      </button>

      <div style={card}>
        <div style={{ fontWeight: 900, fontSize: 20, marginBottom: 8 }}>
          {completedJobReport.name}
        </div>

        <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
          <div>
            <strong>Patio Sqft:</strong>{" "}
            {Number(completedJobReport.patio_sqft || 0)}
          </div>
          <div>
            <strong>Wall Sqft:</strong>{" "}
            {Number(completedJobReport.wall_sqft || 0)}
          </div>
          <div>
            <strong>Cap LF:</strong>{" "}
            {Number(completedJobReport.cap_lf || 0)}
          </div>
          <div>
            <strong>Completed:</strong>{" "}
            {completedJobReport.completed_at
              ? new Date(completedJobReport.completed_at).toLocaleString()
              : "—"}
          </div>
          <div>
            <strong>Total Labor:</strong>{" "}
            {Number(completedJobReport.total_hours || 0).toFixed(2)} hrs
          </div>
          <div>
            <strong>Install Rate:</strong>{" "}
            {Number(completedJobReport.min_per_sqft || 0).toFixed(2)} min/sqft
          </div>
        </div>
      </div>

      <div style={card}>
        <div style={{ fontWeight: 900, marginBottom: 10 }}>
          Activity Breakdown
        </div>

        {completedJobActivities.length === 0 ? (
          <div style={{ color: "#6b7280" }}>No activity breakdown found.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {completedJobActivities.map((a) => (
              <div
                key={`${a.job_id}-${a.activity}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto auto",
                  gap: 10,
                  padding: 10,
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  background: "white",
                  alignItems: "center",
                }}
              >
                <div style={{ color: "#6b7280" }}>{a.activity}</div>

                <div style={{ fontWeight: 800 }}>
                  {Number(a.total_hours || 0).toFixed(2)} hrs
                </div>

                <div
                  style={{
                    color: "#6b7280",
                    fontSize: 13,
                    textAlign: "right",
                  }}
                >
                  {a.unit_rate == null
                    ? "—"
                    : `${Number(a.unit_rate).toFixed(2)} ${a.unit_rate_label || ""}`}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={card}>
        <div style={{ fontWeight: 900, marginBottom: 10 }}>
          Job Notes / Delay Context
        </div>

        {completedJobNotes.length === 0 ? (
          <div style={{ color: "#6b7280" }}>No notes found for this job.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {completedJobNotes.map((note) => (
              <div
                key={note.id}
                style={{
                  padding: 10,
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  background: "white",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    marginBottom: 6,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ fontWeight: 800 }}>{note.note_type}</div>
                  <div style={{ color: "#6b7280", fontSize: 12 }}>
                    {new Date(note.created_at).toLocaleString()}
                  </div>
                </div>

                <div style={{ color: "#111827", whiteSpace: "pre-wrap" }}>
                  {note.note_text}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}