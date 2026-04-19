import React from "react";

const NOTE_TYPES = [
  "Weather",
  "Material Delay",
  "Equipment Issue",
  "Access Problem",
  "Change Order",
  "Rework",
  "Safety",
  "General",
];

function fmtClock(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(totalSec / 3600)).padStart(2, "0");
  const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export default function JobDetailScreen({
  card,
  btn,
  btnPrimary,
  input,
  goJobs,
  currentJob,
  isManager,
  activities,
  activeTimer,
  runningElapsedMs,
  startTimer,
  stopTimer,
  manualEntry,
  setManualEntry,
  addManual,
  jobNotes,
  notesLoading,
  newNoteType,
  setNewNoteType,
  newNoteText,
  setNewNoteText,
  addJobNote,
  addingNote,
  updateJob,
  completeJob,
  editingEntry,
  editMinutes,
  setEditMinutes,
  editActivity,
  setEditActivity,
  startEditEntry,
  saveEditEntry,
  setEditingEntry,
  deleteEntry,
}) {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <button style={btn} onClick={goJobs}>
        ← Back
      </button>

      {isManager && (
        <button style={btn} onClick={completeJob}>
          Complete Job
        </button>
      )}

      <div style={card}>
        <div style={{ fontWeight: 900, fontSize: 18 }}>
          {currentJob.name}
        </div>

        <div style={{ height: 10 }} />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 10,
          }}
        >
          <div>
            <div style={{ color: "#6b7280", fontSize: 13 }}>Patio Sqft</div>
            <input
              style={input}
              inputMode="decimal"
              value={currentJob.patio_sqft || 0}
              onChange={(e) =>
                updateJob(currentJob.id, {
                  patio_sqft: Number(e.target.value) || 0,
                })
              }
            />
          </div>

          <div>
            <div style={{ color: "#6b7280", fontSize: 13 }}>Wall Sqft</div>
            <input
              style={input}
              inputMode="decimal"
              value={currentJob.wall_sqft || 0}
              onChange={(e) =>
                updateJob(currentJob.id, {
                  wall_sqft: Number(e.target.value) || 0,
                })
              }
            />
          </div>

          <div>
            <div style={{ color: "#6b7280", fontSize: 13 }}>Cap LF</div>
            <input
              style={input}
              inputMode="decimal"
              value={currentJob.cap_lf || 0}
              onChange={(e) =>
                updateJob(currentJob.id, {
                  cap_lf: Number(e.target.value) || 0,
                })
              }
            />
          </div>
        </div>
      </div>

      <div style={card}>
        <div style={{ fontWeight: 900, marginBottom: 10 }}>
          Start/Stop Timer (by Activity)
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 10,
          }}
        >
          {activities.map((act) => {
            const runningThis =
              activeTimer &&
              activeTimer.jobId === currentJob.id &&
              activeTimer.activity === act;

            const disabled = !!activeTimer && !runningThis;

            return (
              <button
                key={act}
                style={{
                  ...btn,
                  padding: "14px 12px",
                  borderRadius: 16,
                  border: runningThis
                    ? "2px solid #111827"
                    : "1px solid #d1d5db",
                  opacity: disabled ? 0.5 : 1,
                }}
                disabled={disabled}
                onClick={() =>
                  runningThis
                    ? stopTimer()
                    : startTimer(currentJob.id, act)
                }
                title={disabled ? "Stop current timer first" : "Start timer"}
              >
                <div
                  style={{
                    fontWeight: 900,
                    fontSize: 14,
                    lineHeight: 1.2,
                  }}
                >
                  {act}
                </div>
                {runningThis && (
                  <div style={{ marginTop: 6, fontWeight: 900 }}>
                    {fmtClock(runningElapsedMs)} running
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div style={card}>
        <div style={{ fontWeight: 900, marginBottom: 10 }}>Manual Add</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr 120px",
            gap: 10,
          }}
        >
          <select
            style={input}
            value={manualEntry.activity}
            onChange={(e) =>
              setManualEntry((m) => ({ ...m, activity: e.target.value }))
            }
          >
            {activities.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>

          <input
            style={input}
            placeholder="Minutes"
            inputMode="decimal"
            value={manualEntry.minutes}
            onChange={(e) =>
              setManualEntry((m) => ({ ...m, minutes: e.target.value }))
            }
          />

          <button
            style={btnPrimary}
            onClick={() => addManual(currentJob.id)}
          >
            Add
          </button>
        </div>
      </div>

      <div style={card}>
        <div style={{ fontWeight: 900, marginBottom: 10 }}>
          Job Notes / Delay Tracking
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 140px",
            gap: 10,
            marginBottom: 10,
          }}
        >
          <select
            style={input}
            value={newNoteType}
            onChange={(e) => setNewNoteType(e.target.value)}
          >
            {NOTE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          <button
            style={btnPrimary}
            onClick={() => addJobNote(currentJob.id)}
            disabled={addingNote || !newNoteText.trim()}
          >
            {addingNote ? "Saving..." : "Add Note"}
          </button>
        </div>

        <textarea
          style={{
            ...input,
            minHeight: 90,
            resize: "vertical",
            marginBottom: 12,
          }}
          placeholder="Add context about weather, delays, material issues, access problems, rework, etc."
          value={newNoteText}
          onChange={(e) => setNewNoteText(e.target.value)}
        />

        {notesLoading ? (
          <div style={{ color: "#6b7280" }}>Loading notes...</div>
        ) : jobNotes.length === 0 ? (
          <div style={{ color: "#6b7280" }}>No notes yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {jobNotes.map((note) => (
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

      <div style={card}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Entries</div>

        {(currentJob.entries || []).length === 0 ? (
          <div style={{ color: "#6b7280" }}>No entries yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            {(currentJob.entries || [])
              .slice()
              .reverse()
              .map((e) => (
                <div
                  key={e.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: 10,
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    background: "white",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800 }}>{e.activity}</div>
                    <div>{(Number(e.minutes) || 0).toFixed(2)} min</div>
                  </div>

                  {isManager && (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button style={btn} onClick={() => startEditEntry(e)}>
                        Edit
                      </button>
                      <button style={btn} onClick={() => deleteEntry(e)}>
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>

      {editingEntry && (
        <div style={card}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Edit Entry</div>

          <div style={{ display: "grid", gap: 10 }}>
            <select
              style={input}
              value={editActivity}
              onChange={(e) => setEditActivity(e.target.value)}
            >
              {activities.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>

            <input
              style={input}
              value={editMinutes}
              onChange={(e) => setEditMinutes(e.target.value)}
              placeholder="Minutes"
            />

            <div style={{ display: "flex", gap: 10 }}>
              <button style={btnPrimary} onClick={saveEditEntry}>
                Save
              </button>
              <button style={btn} onClick={() => setEditingEntry(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}