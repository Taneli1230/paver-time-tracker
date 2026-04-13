import React from "react";

export default function PaversJobsScreen({
  card,
  input,
  btnPrimary,
  state,
  newJob,
  setNewJob,
  addJob,
  openJob,
}) {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={card}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>New Job</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr 1fr 1fr 130px",
            gap: 10,
          }}
        >
          <input
            style={input}
            placeholder="Job name"
            value={newJob.name}
            onChange={(e) =>
              setNewJob((j) => ({ ...j, name: e.target.value }))
            }
          />
          <input
            style={input}
            placeholder="Patio Sqft"
            inputMode="decimal"
            value={newJob.patio_sqft}
            onChange={(e) =>
              setNewJob((j) => ({ ...j, patio_sqft: e.target.value }))
            }
          />
          <input
            style={input}
            placeholder="Wall Sqft"
            inputMode="decimal"
            value={newJob.wall_sqft}
            onChange={(e) =>
              setNewJob((j) => ({ ...j, wall_sqft: e.target.value }))
            }
          />
          <input
            style={input}
            placeholder="Cap LF"
            inputMode="decimal"
            value={newJob.cap_lf}
            onChange={(e) =>
              setNewJob((j) => ({ ...j, cap_lf: e.target.value }))
            }
          />
          <button style={btnPrimary} onClick={addJob}>
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
          <div style={{ fontWeight: 800 }}>Jobs</div>
          <div style={{ color: "#6b7280", fontSize: 13 }}>
            {state.jobs.length} total
          </div>
        </div>

        <div style={{ height: 10 }} />

        {state.jobs.length === 0 ? (
          <div style={{ color: "#6b7280" }}>
            No jobs yet. Add your first job above.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {state.jobs.map((j) => {
              const totalM = Number(j.total_minutes) || 0;
              const hrs = totalM / 60;

              return (
                <div
                  key={j.id}
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
                    <div style={{ fontWeight: 800 }}>{j.name}</div>
                    <div style={{ color: "#6b7280", fontSize: 13 }}>
                      Patio: {Number(j.patio_sqft || 0)} sqft • Wall:{" "}
                      {Number(j.wall_sqft || 0)} sqft • Cap:{" "}
                      {Number(j.cap_lf || 0)} lf
                    </div>
                    <div style={{ color: "#6b7280", fontSize: 13 }}>
                      {hrs.toFixed(2)} hrs
                    </div>
                  </div>

                  <button style={btnPrimary} onClick={() => openJob(j.id)}>
                    Open
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}