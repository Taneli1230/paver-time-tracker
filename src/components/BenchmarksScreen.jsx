import React from "react";

export default function BenchmarksScreen({
  card,
  btn,
  goJobs,
  analysisLoading,
  analysisSummary,
  filteredAnalysisRows,
  benchmarkSummaryRows,
  excludeDelayedBenchmarks,
  setExcludeDelayedBenchmarks,
}) {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <button style={btn} onClick={goJobs}>
        ← Back to Jobs
      </button>

      <div
        style={{
          ...card,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 18 }}>
          Production Benchmarks
        </div>

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
            checked={excludeDelayedBenchmarks}
            onChange={(e) => setExcludeDelayedBenchmarks(e.target.checked)}
          />
          Exclude delayed jobs from benchmarks
        </label>
      </div>

      {analysisLoading ? (
        <div style={card}>Loading analysis...</div>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            <div style={card}>
              <div style={{ color: "#6b7280", fontSize: 13 }}>Completed Jobs</div>
              <div style={{ fontWeight: 900, fontSize: 24 }}>
                {analysisSummary.completedCount}
              </div>
            </div>
            <div style={card}>
              <div style={{ color: "#6b7280", fontSize: 13 }}>Clean Jobs</div>
              <div style={{ fontWeight: 900, fontSize: 24 }}>
                {analysisSummary.cleanCount}
              </div>
            </div>
            <div style={card}>
              <div style={{ color: "#6b7280", fontSize: 13 }}>Delayed Jobs</div>
              <div style={{ fontWeight: 900, fontSize: 24 }}>
                {analysisSummary.delayedCount}
              </div>
            </div>
            <div style={card}>
              <div style={{ color: "#6b7280", fontSize: 13 }}>Avg Hours (current filter)</div>
              <div style={{ fontWeight: 900, fontSize: 24 }}>
                {analysisSummary.avgHours.toFixed(2)}
              </div>
            </div>
            <div style={card}>
              <div style={{ color: "#6b7280", fontSize: 13 }}>Avg Clean Job Hours</div>
              <div style={{ fontWeight: 900, fontSize: 24 }}>
                {analysisSummary.avgCleanHours.toFixed(2)}
              </div>
            </div>
            <div style={card}>
              <div style={{ color: "#6b7280", fontSize: 13 }}>Avg Delayed Job Hours</div>
              <div style={{ fontWeight: 900, fontSize: 24 }}>
                {analysisSummary.avgDelayedHours.toFixed(2)}
              </div>
            </div>
          </div>

          <div style={card}>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>
              Activity Benchmarks
            </div>

            {benchmarkSummaryRows.length === 0 ? (
              <div style={{ color: "#6b7280" }}>No completed activity data yet.</div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {benchmarkSummaryRows.map((row) => (
                  <div
                    key={row.activity}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "2fr 1fr 1fr 1fr",
                      gap: 10,
                      padding: 10,
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      background: "white",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ fontWeight: 800 }}>{row.activity}</div>
                    <div>
                      <div style={{ color: "#6b7280", fontSize: 12 }}>Total Hrs</div>
                      <div style={{ fontWeight: 800 }}>{row.total_hours.toFixed(2)}</div>
                    </div>
                    <div>
                      <div style={{ color: "#6b7280", fontSize: 12 }}>Avg Hrs/Job</div>
                      <div style={{ fontWeight: 800 }}>{row.avg_hours_per_job.toFixed(2)}</div>
                    </div>
                    <div>
                      <div style={{ color: "#6b7280", fontSize: 12 }}>Avg Min/Sqft</div>
                      <div style={{ fontWeight: 800 }}>
                        {row.avg_min_per_sqft == null ? "—" : row.avg_min_per_sqft.toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={card}>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>
              Completed Job Analysis
            </div>

            {filteredAnalysisRows.length === 0 ? (
              <div style={{ color: "#6b7280" }}>No completed jobs found for this filter.</div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {filteredAnalysisRows.map((row) => {
                  const totalMeasure =
                    Number(row.patio_sqft || 0) + Number(row.wall_sqft || 0);
                  const minPerSqft =
                    totalMeasure > 0 ? Number(row.total_minutes || 0) / totalMeasure : 0;

                  return (
                    <div
                      key={row.job_id}
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
                        <div style={{ fontWeight: 800 }}>{row.name}</div>
                        <div style={{ color: "#6b7280", fontSize: 13 }}>
                          Patio: {Number(row.patio_sqft || 0)} sqft • Wall:{" "}
                          {Number(row.wall_sqft || 0)} sqft • Cap: {Number(row.cap_lf || 0)} lf
                        </div>
                        <div style={{ color: "#6b7280", fontSize: 13 }}>
                          {row.has_delay ? "Delayed job" : "Clean job"} •{" "}
                          {Number(row.note_count || 0)} notes
                        </div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 900 }}>
                          {Number(row.total_hours || 0).toFixed(2)} hrs
                        </div>
                        <div style={{ color: "#6b7280", fontSize: 13 }}>
                          {minPerSqft > 0 ? `${minPerSqft.toFixed(2)} min/sqft` : "—"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}