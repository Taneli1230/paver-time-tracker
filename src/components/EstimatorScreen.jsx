import React from "react";

export default function EstimatorScreen({
  card,
  btn,
  btnPrimary,
  input,
  goJobs,
  estimateInputs,
  setEstimateInputs,
  excludeDelayedEstimate,
  setExcludeDelayedEstimate,
  estimateLoading,
  estimateResult,
  calculateEstimate,
}) {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <button style={btn} onClick={goJobs}>
        ← Back to Jobs
      </button>

      <div style={card}>
        <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 10 }}>
          Estimate New Job
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 10,
            marginBottom: 12,
          }}
        >
          <input
            style={input}
            placeholder="Patio Sqft"
            inputMode="decimal"
            value={estimateInputs.patio_sqft}
            onChange={(e) =>
              setEstimateInputs((s) => ({ ...s, patio_sqft: e.target.value }))
            }
          />

          <input
            style={input}
            placeholder="Wall Sqft"
            inputMode="decimal"
            value={estimateInputs.wall_sqft}
            onChange={(e) =>
              setEstimateInputs((s) => ({ ...s, wall_sqft: e.target.value }))
            }
          />

          <input
            style={input}
            placeholder="Cap LF"
            inputMode="decimal"
            value={estimateInputs.cap_lf}
            onChange={(e) =>
              setEstimateInputs((s) => ({ ...s, cap_lf: e.target.value }))
            }
          />
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontWeight: 600,
            }}
          >
            <input
              type="checkbox"
              checked={excludeDelayedEstimate}
              onChange={(e) => setExcludeDelayedEstimate(e.target.checked)}
            />
            Exclude delayed jobs
          </label>

          <button
            style={btnPrimary}
            onClick={calculateEstimate}
            disabled={estimateLoading}
          >
            {estimateLoading ? "Loading..." : "Calculate Estimate"}
          </button>
        </div>
      </div>

      {estimateResult && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            <div style={card}>
              <div style={{ color: "#6b7280", fontSize: 13 }}>Low Estimate</div>
              <div style={{ fontWeight: 900, fontSize: 24 }}>
                {estimateResult.low_hours.toFixed(2)} hrs
              </div>
            </div>

            <div style={card}>
              <div style={{ color: "#6b7280", fontSize: 13 }}>Likely Estimate</div>
              <div style={{ fontWeight: 900, fontSize: 24 }}>
                {estimateResult.likely_hours.toFixed(2)} hrs
              </div>
            </div>

            <div style={card}>
              <div style={{ color: "#6b7280", fontSize: 13 }}>High Estimate</div>
              <div style={{ fontWeight: 900, fontSize: 24 }}>
                {estimateResult.high_hours.toFixed(2)} hrs
              </div>
            </div>
          </div>

          <div style={card}>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>
              Similar Jobs Used ({estimateResult.match_count})
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              {estimateResult.matches.map((job) => (
                <div
                  key={job.job_id}
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
                    <div style={{ fontWeight: 800 }}>{job.name}</div>
                    <div style={{ color: "#6b7280", fontSize: 13 }}>
                      Patio: {Number(job.patio_sqft || 0)} sqft • Wall:{" "}
                      {Number(job.wall_sqft || 0)} sqft • Cap:{" "}
                      {Number(job.cap_lf || 0)} lf
                    </div>
                    <div style={{ color: "#6b7280", fontSize: 13 }}>
                      {job.has_delay ? "Delayed job" : "Clean job"} •
                      Similarity {job.similarity.toFixed(3)}
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 900 }}>
                      {Number(job.total_hours || 0).toFixed(2)} hrs
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}