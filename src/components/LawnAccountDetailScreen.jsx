import React, { useState } from "react";

function fmtClock(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(totalSec / 3600)).padStart(2, "0");
  const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export default function LawnAccountDetailScreen({
  card,
  btn,
  btnPrimary,
  input,
  account,
  visits,
  goBack,
  onAddVisit,
  onUpdateAccount,
  onStartTimer,
  onStopTimer,
  onEditVisit,
  onDeleteVisit,
  activeTimer,
  runningElapsedMs,
  isManager,
}) {
  const [manualService, setManualService] = useState("Mowing");
  const [manualMinutes, setManualMinutes] = useState("");
  const [manualNotes, setManualNotes] = useState("");
  const [editing, setEditing] = useState(false);
  const [editFields, setEditFields] = useState({});
  const [showManual, setShowManual] = useState(false);

  function handleManualAdd() {
    const mins = Number(manualMinutes);
    if (!mins || mins <= 0) {
      alert("Enter valid minutes.");
      return;
    }
    onAddVisit({
      service_type: manualService,
      total_minutes: mins,
      notes: manualNotes.trim() || null,
    });
    setManualMinutes("");
    setManualNotes("");
  }

  function startEditing() {
    setEditFields({
      name: account.name || "",
      address: account.address || "",
      cut_price: account.cut_price || "",
      spray_rate_per_min: account.spray_rate_per_min || "",
      frequency: account.frequency || "weekly",
      sqft: account.sqft || "",
      notes: account.notes || "",
    });
    setEditing(true);
  }

  function saveEdits() {
    onUpdateAccount(account.id, {
      name: editFields.name.trim() || account.name,
      address: editFields.address.trim(),
      cut_price: Number(editFields.cut_price) || 0,
      spray_rate_per_min: Number(editFields.spray_rate_per_min) || 2,
      frequency: editFields.frequency,
      sqft: Number(editFields.sqft) || 0,
      notes: editFields.notes.trim() || null,
    });
    setEditing(false);
  }

  // Group mowing visits by date — multiple workers = one cut
  const mowingByDate = new Map();
  const sprayVisits = [];

  for (const v of visits) {
    if (v.service_type === "Mowing") {
      if (!mowingByDate.has(v.visit_date)) {
        mowingByDate.set(v.visit_date, {
          total_minutes: 0,
          worker_count: 0,
        });
      }
      const entry = mowingByDate.get(v.visit_date);
      entry.total_minutes += Number(v.total_minutes || 0);
      entry.worker_count += 1;
    } else {
      sprayVisits.push(v);
    }
  }

  const mowingCutCount = mowingByDate.size;
  const totalMowingMinutes = Array.from(mowingByDate.values()).reduce(
    (sum, e) => sum + e.total_minutes,
    0
  );
  const totalSprayMinutes = sprayVisits.reduce(
    (sum, v) => sum + Number(v.total_minutes || 0),
    0
  );

  const avgMowingMinutes =
    mowingCutCount > 0 ? totalMowingMinutes / mowingCutCount : 0;

  const mowingRevenue = mowingCutCount * Number(account.cut_price || 0);
  const sprayRevenue =
    totalSprayMinutes * Number(account.spray_rate_per_min || 2);
  const totalRevenue = mowingRevenue + sprayRevenue;

  const totalMinutesAll = totalMowingMinutes + totalSprayMinutes;
  const effectiveHourlyRate =
    totalMinutesAll > 0 ? (totalRevenue / totalMinutesAll) * 60 : 0;

  const totalVisits = mowingCutCount + sprayVisits.length;

  const timerRunningHere =
    activeTimer && activeTimer.accountId === account.id;

  const SERVICES = ["Mowing", "Spray/Weed"];

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <button style={btn} onClick={goBack}>
        ← Back to Accounts
      </button>

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
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 900, fontSize: 18 }}>{account.name}</div>
              {totalVisits > 0 && (
                <div
                  style={{
                    padding: "3px 10px",
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 700,
                    background:
                      effectiveHourlyRate >= 45
                        ? "#dcfce7"
                        : effectiveHourlyRate >= 35
                        ? "#fef9c3"
                        : "#fee2e2",
                    color:
                      effectiveHourlyRate >= 45
                        ? "#166534"
                        : effectiveHourlyRate >= 35
                        ? "#854d0e"
                        : "#991b1b",
                  }}
                >
                  {effectiveHourlyRate >= 45
                    ? "Profitable"
                    : effectiveHourlyRate >= 35
                    ? "Break Even"
                    : "Under Target"}
                </div>
              )}
            </div>
            <div style={{ color: "#6b7280", fontSize: 13 }}>
              {account.address || "No address"}
            </div>
          </div>

          {isManager && !editing && (
            <button style={btn} onClick={startEditing}>
              Edit Account
            </button>
          )}
        </div>

        {!editing ? (
          <div style={{ color: "#6b7280", fontSize: 13 }}>
            {isManager && (
              <>
                ${Number(account.cut_price || 0).toFixed(2)}/cut •{" "}
                ${Number(account.spray_rate_per_min || 2).toFixed(2)}/min spray •{" "}
              </>
            )}
            {account.frequency}
            {Number(account.sqft || 0) > 0 && ` • ${account.sqft} sqft`}
            {account.notes && ` • ${account.notes}`}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            <div className="form-row-2">
              <input
                style={input}
                placeholder="Account Name"
                value={editFields.name}
                onChange={(e) =>
                  setEditFields((s) => ({ ...s, name: e.target.value }))
                }
              />
              <input
                style={input}
                placeholder="Address"
                value={editFields.address}
                onChange={(e) =>
                  setEditFields((s) => ({ ...s, address: e.target.value }))
                }
              />
            </div>

            <div className="form-row-4">
              <input
                style={input}
                placeholder="Cut Price ($)"
                inputMode="decimal"
                value={editFields.cut_price}
                onChange={(e) =>
                  setEditFields((s) => ({ ...s, cut_price: e.target.value }))
                }
              />
              <input
                style={input}
                placeholder="Spray $/min"
                inputMode="decimal"
                value={editFields.spray_rate_per_min}
                onChange={(e) =>
                  setEditFields((s) => ({
                    ...s,
                    spray_rate_per_min: e.target.value,
                  }))
                }
              />
              <select
                style={input}
                value={editFields.frequency}
                onChange={(e) =>
                  setEditFields((s) => ({ ...s, frequency: e.target.value }))
                }
              >
                <option value="weekly">Weekly</option>
                <option value="biweekly">Biweekly</option>
                <option value="as_needed">As Needed</option>
              </select>
              <input
                style={input}
                placeholder="Sqft"
                inputMode="decimal"
                value={editFields.sqft}
                onChange={(e) =>
                  setEditFields((s) => ({ ...s, sqft: e.target.value }))
                }
              />
            </div>

            <input
              style={input}
              placeholder="Notes"
              value={editFields.notes}
              onChange={(e) =>
                setEditFields((s) => ({ ...s, notes: e.target.value }))
              }
            />

            <div style={{ display: "flex", gap: 10 }}>
              <button style={btnPrimary} onClick={saveEdits}>
                Save
              </button>
              <button style={btn} onClick={() => setEditing(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {isManager && (
        <div className="stats-grid-4">
          <div style={card}>
            <div style={{ color: "#6b7280", fontSize: 13 }}>Total Visits</div>
            <div style={{ fontWeight: 900, fontSize: 24 }}>{totalVisits}</div>
          </div>
          <div style={card}>
            <div style={{ color: "#6b7280", fontSize: 13 }}>Avg Min/Cut</div>
            <div style={{ fontWeight: 900, fontSize: 24 }}>
              {avgMowingMinutes.toFixed(0)}
            </div>
          </div>
          <div style={card}>
            <div style={{ color: "#6b7280", fontSize: 13 }}>Total Revenue</div>
            <div style={{ fontWeight: 900, fontSize: 24 }}>
              ${totalRevenue.toFixed(2)}
            </div>
          </div>
          <div style={card}>
            <div style={{ color: "#6b7280", fontSize: 13 }}>Effective $/hr</div>
            <div style={{ fontWeight: 900, fontSize: 24 }}>
              ${effectiveHourlyRate.toFixed(2)}
            </div>
          </div>
        </div>
      )}

      <div style={card}>
        <div style={{ fontWeight: 900, marginBottom: 10 }}>
          Start/Stop Timer
        </div>

        <div className="timer-grid">
          {SERVICES.map((svc) => {
            const runningThis =
              timerRunningHere && activeTimer.serviceType === svc;
            const disabled = !!activeTimer && !runningThis;

            return (
              <button
                key={svc}
                className="timer-btn"
                style={{
                  border: runningThis
                    ? "2px solid #111827"
                    : "1px solid #d1d5db",
                  opacity: disabled ? 0.5 : 1,
                }}
                disabled={disabled}
                onClick={() =>
                  runningThis
                    ? onStopTimer()
                    : onStartTimer(account.id, svc)
                }
                title={disabled ? "Stop current timer first" : "Start timer"}
              >
                <div
                  style={{
                    fontWeight: 900,
                    fontSize: 16,
                    lineHeight: 1.2,
                  }}
                >
                  {svc}
                </div>
                {runningThis && (
                  <div style={{ marginTop: 6, fontWeight: 900, fontSize: 18 }}>
                    {fmtClock(runningElapsedMs)} running
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div style={card}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <div style={{ fontWeight: 900 }}>Manual Add</div>
          <button
            style={btn}
            onClick={() => setShowManual(!showManual)}
          >
            {showManual ? "Hide" : "Show"}
          </button>
        </div>

        {showManual && (
          <div className="form-row-manual-lawn">
            <select
              style={input}
              value={manualService}
              onChange={(e) => setManualService(e.target.value)}
            >
              <option value="Mowing">Mowing</option>
              <option value="Spray/Weed">Spray/Weed</option>
            </select>

            <input
              style={input}
              placeholder="Minutes"
              inputMode="decimal"
              value={manualMinutes}
              onChange={(e) => setManualMinutes(e.target.value)}
            />

            <input
              style={input}
              placeholder="Notes (optional)"
              value={manualNotes}
              onChange={(e) => setManualNotes(e.target.value)}
            />

            <button style={btnPrimary} onClick={handleManualAdd}>
              Log Visit
            </button>
          </div>
        )}
      </div>

      <div style={card}>
        <div style={{ fontWeight: 900, marginBottom: 10 }}>Visit History</div>

        {visits.length === 0 ? (
          <div style={{ color: "#6b7280" }}>No visits logged yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {visits.map((v) => {
              const charge =
                v.service_type === "Mowing"
                  ? Number(account.cut_price || 0)
                  : Number(v.total_minutes || 0) *
                    Number(account.spray_rate_per_min || 2);

              return (
                <div
                  key={v.id}
                  className="item-row"
                  style={{
                    padding: 10,
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    background: "white",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800 }}>
                      {v.service_type} —{" "}
                      {new Date(v.visit_date + "T12:00:00").toLocaleDateString(
                        [],
                        {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        }
                      )}
                    </div>
                    <div style={{ color: "#6b7280", fontSize: 13 }}>
                      {Number(v.total_minutes || 0).toFixed(0)} min
                      {v.notes && ` • ${v.notes}`}
                    </div>
                  </div>

                  {isManager && (
                    <div style={{ textAlign: "right", display: "grid", gap: 4 }}>
                      <div style={{ fontWeight: 900 }}>${charge.toFixed(2)}</div>
                      {v.billed && (
                        <div
                          style={{
                            color: "#10b981",
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          Billed
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <button
                          style={{ ...btn, fontSize: 11, padding: "4px 8px" }}
                          onClick={() => onEditVisit(v)}
                        >
                          Edit
                        </button>
                        <button
                          style={{ ...btn, fontSize: 11, padding: "4px 8px" }}
                          onClick={() => onDeleteVisit(v)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}