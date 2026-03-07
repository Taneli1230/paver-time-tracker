import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabaseClient";

const STORAGE_KEY = "paver_time_tracker_v1";

const DEFAULT_ACTIVITIES = [
  "Travel",
  "Mobilize / Unload",
  "Excavation",
  "Base Prep (stone/compact)",
  "Screed / Bedding",
  "Lay Pavers",
  "Cuts / Edge Restraint",
  "Poly Sand / Compact",
  "Cleanup / Haul",
  "Other / Issues",
];

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function fmtHrs(mins) {
  const h = mins / 60;
  return Number.isFinite(h) ? h.toFixed(2) : "0.00";
}

function fmtClock(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(totalSec / 3600)).padStart(2, "0");
  const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function now() {
  return Date.now();
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { activities: DEFAULT_ACTIVITIES, jobs: [], activeTimer: null };
    }
    const parsed = JSON.parse(raw);
    return {
      activities: Array.isArray(parsed.activities) && parsed.activities.length ? parsed.activities : DEFAULT_ACTIVITIES,
      jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [],
      activeTimer: parsed.activeTimer ?? null,
    };
  } catch {
    return { activities: DEFAULT_ACTIVITIES, jobs: [], activeTimer: null };
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function minutesBetween(startMs, endMs) {
  return Math.max(0, (endMs - startMs) / 60000);
}

function sumMinutes(entries) {
  return entries.reduce((acc, e) => acc + (e.minutes || 0), 0);
}

function toCSV(rows) {
  const esc = (v) => {
    const s = String(v ?? "");
    if (s.includes('"') || s.includes(",") || s.includes("\n")) {
      return `"${s.replaceAll('"', '""')}"`;
    }
    return s;
  };
  return rows.map((r) => r.map(esc).join(",")).join("\n");
}

export default function App() {
  const [state, setState] = useState(() => loadState());
  const [view, setView] = useState({ screen: "jobs", jobId: null });
  const [dashboardRows, setDashboardRows] = useState([]);
  const [jobProgressRows, setJobProgressRows] = useState([]);
  const [jobActivityRows, setJobActivityRows] = useState([]);
  const [completedJobs, setCompletedJobs] = useState([]);
  const [newJob, setNewJob] = useState({ name: "", sqft: "" });
  const [manualEntry, setManualEntry] = useState({ activity: DEFAULT_ACTIVITIES[0], minutes: "" });
  const tickRef = useRef(0);

  const [session, setSession] = useState(null);
const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const [crewId, setCrewId] = useState(null);

useEffect(() => {
  if (!session) return;

  (async () => {
    const { data, error } = await supabase
      .from("crew_members") // your table name is singular
      .select("crew_id")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (error) {
      console.error("crew lookup error", error);
      return;
    }
    console.log("Crew lookup result:", data);

if (!data) {
  console.warn("User is not assigned to a crew.");
  return;
}

setCrewId(data.crew_id);
  })();
}, [session]);
useEffect(() => {
  if (!crewId) return;

  (async () => {
    const { data: jobs, error: jErr } = await supabase
      .from("jobs")
      .select("*")
      .eq("crew_id", crewId)
      .order("created_at", { ascending: false });

    if (jErr) {
      console.error("jobs load error", jErr);
      return;
    }

    const { data: totals, error: tErr } = await supabase
      .from("job_totals")
      .select("*")
      .eq("crew_id", crewId);

    if (tErr) {
      console.error("totals load error", tErr);
      return;
    }

    const totalsMap = new Map((totals ?? []).map((r) => [r.job_id, Number(r.total_minutes) || 0]));

    setState((s) => ({
      ...s,
      jobs: (jobs ?? []).map((j) => ({
        ...j,
        entries: [], // keep; entries still load when opening job
        total_minutes: totalsMap.get(j.id) ?? 0, // ⭐ new
      })),
    }));
  })();
}, [crewId]);
useEffect(() => {
  if (!session || !crewId) return;

  (async () => {
    const { data: timer, error } = await supabase
      .from("active_timers")
      .select("*")
      .eq("worker_id", session.user.id)
      .maybeSingle();

    if (error) {
      console.error("active timer load error", error);
      return;
    }

    if (!timer) return;

    setState((s) => ({
      ...s,
      activeTimer: {
        jobId: timer.job_id,
        activity: timer.activity,
        startedAt: new Date(timer.started_at).getTime(),
        entryId: timer.entry_id,
      },
    }));
  })();
}, [session, crewId]);
useEffect(() => {
  if (view.screen !== "dashboard") return;

  const channel = supabase
    .channel("active-timers")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "active_timers",
      },
      async () => {
        const { data } = await supabase
          .from("active_timer_dashboard")
          .select("*")
          .eq("crew_id", crewId)
          .order("started_at", { ascending: true });

        setDashboardRows(data ?? []);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [view.screen, crewId]);
useEffect(() => {
  supabase.auth.getSession().then(({ data }) => {
    setSession(data.session);
  });

  const { data: listener } = supabase.auth.onAuthStateChange(
    (_event, session) => {
      setSession(session);
    }
  );

  return () => {
    listener.subscription.unsubscribe();
  };
}, []);

// useEffect(() => saveState(state), [state]);

  useEffect(() => {
    const id = setInterval(() => (tickRef.current = now()), 500);
    return () => clearInterval(id);
  }, []);

  const activeTimer = state.activeTimer;

  const jobsById = useMemo(() => {
    const m = new Map();
    for (const j of state.jobs) m.set(j.id, j);
    return m;
  }, [state.jobs]);

  const currentJob = view.screen === "job" ? jobsById.get(view.jobId) : null;

  const runningElapsedMs = useMemo(() => {
    if (!activeTimer) return 0;
    return now() - activeTimer.startedAt;
  }, [activeTimer, tickRef.current]);

  function goJobs() {
    setView({ screen: "jobs", jobId: null });
  }

async function openJob(jobId) {
  setView({ screen: "job", jobId });

  const { data } = await supabase
    .from("entries")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });

  setState((s) => ({
    ...s,
    jobs: s.jobs.map((j) =>
      j.id === jobId ? { ...j, entries: data ?? [] } : j
    ),
  }));
}

async function openDashboard() {
  if (!crewId) {
    alert("Your account is not assigned to a crew yet.");
    return;
  }

  setView({ screen: "dashboard", jobId: null });

  const { data: timers, error: tErr } = await supabase
    .from("active_timer_dashboard")
    .select("*")
    .eq("crew_id", crewId)
    .order("started_at", { ascending: true });

  if (tErr) {
    console.error("dashboard timers load error", tErr);
    alert(tErr.message);
    return;
  }
  setDashboardRows(timers ?? []);

  const { data: progress, error: pErr } = await supabase
    .from("job_progress_dashboard")
    .select("*")
    .eq("crew_id", crewId)
    .order("name", { ascending: true });

  if (pErr) {
    console.error("job progress load error", pErr);
    alert(pErr.message);
    return;
  }
  setJobProgressRows(progress ?? []);

    const { data: activityRows, error: aErr } = await supabase
    .from("job_activity_breakdown")
    .select("*");

  if (aErr) {
    console.error("job activity breakdown load error", aErr);
    alert(aErr.message);
    return;
  }

  setJobActivityRows(activityRows ?? []);
}

async function openCompletedJobs() {
  if (!crewId) {
    alert("Your account is not assigned to a crew yet.");
    return;
  }

  setView({ screen: "completed", jobId: null });

  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("crew_id", crewId)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false });

  if (error) {
    console.error("completed jobs load error", error);
    alert(error.message);
    return;
  }

  setCompletedJobs(data ?? []);
}

async function addJob() {
  const name = newJob.name.trim() || "Untitled Job";
  const sqftNum = Number(String(newJob.sqft).trim());

  if (!Number.isFinite(sqftNum) || sqftNum <= 0) {
    alert("Please enter a valid sqft (greater than 0).");
    return;
  }

  if (!crewId) {
    alert("Crew not loaded yet. Try again.");
    return;
  }

  const { data, error } = await supabase
    .from("jobs")
    .insert([
      {
        crew_id: crewId,
        name,
        sqft: sqftNum,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error(error);
    alert(error.message);
    return;
  }

  setState((s) => ({
    ...s,
    jobs: [{ ...data, entries: [] }, ...s.jobs],
  }));

  setNewJob({ name: "", sqft: "" });
}

  function updateJob(jobId, patch) {
    setState((s) => ({ ...s, jobs: s.jobs.map((j) => (j.id === jobId ? { ...j, ...patch } : j)) }));
  }

async function startTimer(jobId, activity) {
  if (!session) return alert("Not logged in");
  if (!crewId) return alert("Crew not loaded yet.");

  // 1) create an entry row immediately
  const startedISO = new Date().toISOString();

  const { data: entry, error: entryErr } = await supabase
    .from("entries")
    .insert({
      crew_id: crewId,
      job_id: jobId,
      worker_id: session.user.id,
      activity,
      minutes: 0,
      started_at: startedISO,
      ended_at: null,
    })
    .select()
    .single();

  if (entryErr) {
    console.error(entryErr);
    return alert(entryErr.message);
  }

  // 2) upsert active timer referencing that entry
  const { error: timerErr } = await supabase
    .from("active_timers")
    .upsert({
      worker_id: session.user.id,
      crew_id: crewId,
      job_id: jobId,
      activity,
      started_at: startedISO,
      entry_id: entry.id,
    });

  if (timerErr) {
    console.error(timerErr);
    return alert(timerErr.message);
  }

  setState((s) => ({
    ...s,
    activeTimer: {
      jobId,
      activity,
      startedAt: new Date(startedISO).getTime(),
      entryId: entry.id,
    },
  }));
}

async function stopTimer() {
  if (!session || !crewId) return;
  if (!state.activeTimer) return;

  const { data: timer, error } = await supabase
    .from("active_timers")
    .select("*")
    .eq("worker_id", session.user.id)
    .maybeSingle();

  if (error) {
    console.error(error);
    return alert(error.message);
  }
  if (!timer) return;

  const started = new Date(timer.started_at).getTime();
  const ended = Date.now();
  const minutes = (ended - started) / 60000;

  const { error: updErr } = await supabase
    .from("entries")
    .update({
      minutes,
      ended_at: new Date().toISOString(),
    })
    .eq("id", timer.entry_id);

  if (updErr) {
    console.error(updErr);
    return alert(updErr.message);
  }

  await supabase
    .from("active_timers")
    .delete()
    .eq("worker_id", session.user.id);

  setState((s) => ({ ...s, activeTimer: null }));
}

  function addManual(jobId) {
    const mins = Number(String(manualEntry.minutes).trim());
    if (!Number.isFinite(mins) || mins <= 0) {
      alert("Enter valid minutes (> 0).");
      return;
    }
    const entry = { id: uid(), activity: manualEntry.activity, minutes: mins, startedAt: null, endedAt: null };
    setState((s) => ({ ...s, jobs: s.jobs.map((j) => (j.id === jobId ? { ...j, entries: [entry, ...j.entries] } : j)) }));
    setManualEntry((m) => ({ ...m, minutes: "" }));
  }

  function exportCSV() {
    const jobRows = [
      ["Job Name", "Sqft", "Total Hours", "Hours/Sqft", "Minutes/Sqft", "Created At"],
      ...state.jobs.map((j) => {
       const totalM = Number(j.total_minutes) || 0;
        const hrs = totalM / 60;
        const hpsf = j.sqft > 0 ? hrs / j.sqft : 0;
        const mpsf = j.sqft > 0 ? totalM / j.sqft : 0;
        return [j.name, j.sqft, hrs.toFixed(2), hpsf.toFixed(4), mpsf.toFixed(2), j.createdAt];
      }),
    ];

    const entryRows = [
      ["Job Name", "Sqft", "Activity", "Minutes", "Hours", "Started At", "Ended At"],
      ...state.jobs.flatMap((j) =>
        j.entries.map((e) => [
          j.name,
          j.sqft,
          e.activity,
          (e.minutes ?? 0).toFixed(2),
          ((e.minutes ?? 0) / 60).toFixed(2),
          e.startedAt ?? "",
          e.endedAt ?? "",
        ])
      ),
    ];

    const csv = toCSV(jobRows) + "\n\n" + toCSV(entryRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `paver_time_tracker_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const page = {
  maxWidth: 980,
  margin: "0 auto",
  padding: 16,
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
  color: "#111827",
};
  const card = {
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 14,
  background: "white",
  color: "#111827",
  boxShadow: "0 1px 2px rgba(0,0,0,0.04)"
};
  const btn = { padding: "10px 12px", borderRadius: 12, border: "1px solid #d1d5db", background: "white", cursor: "pointer", fontWeight: 600 };
  const btnPrimary = { ...btn, border: "1px solid #111827", background: "#111827", color: "white" };
  const input = { width: "100%", padding: "10px 12px", borderRadius: 12, border: "1px solid #d1d5db", fontSize: 16 };
  // 🔐 If not logged in, show Magic Link login screen
  if (!session) {
    return (
      <div style={{ background: "#f8fafc", minHeight: "100vh" }}>
        <div style={{ maxWidth: 520, margin: "0 auto", padding: 24, fontFamily: page.fontFamily }}>
          <div style={{ ...card, textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 6 }}>Login to Time Tracker</div>
            <div style={{ color: "#6b7280", marginBottom: 14 }}>
              Enter your email and password to sign in.
            </div>

            <input
              style={input}
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
  style={input}
  type="password"
  placeholder="Password"
  value={password}
  onChange={(e) => setPassword(e.target.value)}
/>

            <div style={{ height: 10 }} />

            <button
  style={btnPrimary}
  onClick={async () => {
    if (!email.trim() || !password) return alert("Enter email + password.");

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) return alert(error.message);
  }}
>
  Sign In
</button>

<div style={{ height: 10 }} />

<button
  style={btn}
  onClick={async () => {
    if (!email.trim() || !password) return alert("Enter email + password.");

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (error) return alert(error.message);

    alert("Account created. You can now sign in.");
  }}
>
  Create Account
</button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh" }}>
      <div style={page}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>Paver Patio Time Tracker (MVP)</div>
            <div style={{ color: "#6b7280", fontSize: 13 }}>Track activities → get accurate hours per sqft</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button style={btn} onClick={openDashboard}>Dashboard</button>
            <button style={btn} onClick={openCompletedJobs}>Completed Jobs</button>
            <button style={btn} onClick={exportCSV}>Export CSV</button>
            <button
  style={btn}
  onClick={async () => {
    await supabase.auth.signOut();
  }}
>
  Logout
</button>
            {activeTimer ? (
              <button style={btnPrimary} onClick={stopTimer}>
                Stop Timer ({fmtClock(runningElapsedMs)})
              </button>
            ) : (
              <div style={{ color: "#6b7280", fontWeight: 700, alignSelf: "center" }}>No timer running</div>
            )}
          </div>
        </header>

        <div style={{ height: 14 }} />

        {view.screen === "jobs" && (
          <div style={{ display: "grid", gap: 14 }}>
            <div style={card}>
              <div style={{ fontWeight: 800, marginBottom: 10 }}>New Job</div>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 130px", gap: 10 }}>
                <input style={input} placeholder="Job name (e.g., Smith - Backyard Patio)" value={newJob.name} onChange={(e) => setNewJob((j) => ({ ...j, name: e.target.value }))} />
                <input style={input} placeholder="Sqft" inputMode="decimal" value={newJob.sqft} onChange={(e) => setNewJob((j) => ({ ...j, sqft: e.target.value }))} />
                <button style={btnPrimary} onClick={addJob}>Add</button>
              </div>
            </div>

            <div style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                <div style={{ fontWeight: 800 }}>Jobs</div>
                <div style={{ color: "#6b7280", fontSize: 13 }}>{state.jobs.length} total</div>
              </div>

              <div style={{ height: 10 }} />

              {state.jobs.length === 0 ? (
                <div style={{ color: "#6b7280" }}>No jobs yet. Add your first job above.</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {state.jobs.map((j) => {
                    const totalM = Number(j.total_minutes) || 0;
                    const hrs = totalM / 60;
                    const hpsf = j.sqft > 0 ? hrs / j.sqft : 0;
                    const mpsf = j.sqft > 0 ? totalM / j.sqft : 0;

                    return (
                      <div key={j.id} style={{ padding: 12, borderRadius: 14, border: "1px solid #e5e7eb", background: "white", display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center" }}>
                        <div>
                          <div style={{ fontWeight: 800 }}>{j.name}</div>
                          <div style={{ color: "#6b7280", fontSize: 13 }}>
                            {j.sqft} sqft • {fmtHrs(totalM)} hrs • {hpsf.toFixed(4)} hrs/sqft • {mpsf.toFixed(2)} min/sqft
                          </div>
                        </div>
                        <button style={btnPrimary} onClick={() => openJob(j.id)}>Open</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ color: "#6b7280", fontSize: 12 }}>
             
            </div>
          </div>
        )}

{view.screen === "dashboard" && (
  <div style={{ display: "grid", gap: 14 }}>
    <button style={btn} onClick={goJobs}>← Back to Jobs</button>

    <div style={card}>
      <div style={{ fontWeight: 900, marginBottom: 10 }}>Job Progress</div>

      {jobProgressRows.length === 0 ? (
        <div style={{ color: "#6b7280" }}>No jobs in progress yet.</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {jobProgressRows.map((j) => {
            const activityBreakdown = jobActivityRows.filter((a) => a.job_id === j.job_id);

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
                    <div style={{ fontWeight: 900, color: "#111827" }}>{j.name}</div>
                    <div style={{ color: "#6b7280", fontSize: 13 }}>
                      {j.sqft} sqft
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
                    <div style={{ fontWeight: 800, color: "#111827", fontSize: 13 }}>
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
            const elapsedMs = Date.now() - startedMs;

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

                <div style={{ fontWeight: 900, color: "#111827" }}>
                  {fmtClock(elapsedMs)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  </div>
)}

{view.screen === "completed" && (
  <div style={{ display: "grid", gap: 14 }}>
    <button style={btn} onClick={goJobs}>← Back to Jobs</button>

    <div style={card}>
      <div style={{ fontWeight: 900, marginBottom: 10 }}>Completed Jobs</div>

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
                  <div style={{ fontWeight: 900, color: "#111827" }}>{j.name}</div>
                  <div style={{ color: "#6b7280", fontSize: 13 }}>
                    {j.sqft} sqft • {totalH.toFixed(2)} hrs • {mpsf.toFixed(2)} min/sqft
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
)}

{view.screen === "job" && currentJob && (
  <div style={{ display: "grid", gap: 14 }}>
    <button style={btn} onClick={goJobs}>← Back</button>

    <button
      style={btn}
      onClick={async () => {
        const { error } = await supabase
          .from("jobs")
          .update({ completed_at: new Date().toISOString() })
          .eq("id", currentJob.id);

        if (error) {
          console.error(error);
          alert(error.message);
          return;
        }

        alert("Job marked complete.");
        goJobs();
      }}
    >
      Complete Job
    </button>

    <div style={card}>
      <div style={{ fontWeight: 900, fontSize: 18 }}>{currentJob.name}</div>
      <div style={{ color: "#6b7280", fontSize: 13 }}>Sqft</div>
      <input
        style={input}
        inputMode="decimal"
        value={currentJob.sqft}
        onChange={(e) => updateJob(currentJob.id, { sqft: Number(e.target.value) || 0 })}
      />
    </div>

    <div style={card}>
      <div style={{ fontWeight: 900, marginBottom: 10 }}>Start/Stop Timer (by Activity)</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
        {state.activities.map((act) => {
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
                border: runningThis ? "2px solid #111827" : "1px solid #d1d5db",
                opacity: disabled ? 0.5 : 1,
              }}
              disabled={disabled}
              onClick={() => (runningThis ? stopTimer() : startTimer(currentJob.id, act))}
              title={disabled ? "Stop current timer first" : "Start timer"}
            >
              <div style={{ fontWeight: 900, fontSize: 14, lineHeight: 1.2 }}>{act}</div>
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
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 120px", gap: 10 }}>
        <select
          style={input}
          value={manualEntry.activity}
          onChange={(e) => setManualEntry((m) => ({ ...m, activity: e.target.value }))}
        >
          {state.activities.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>

        <input
          style={input}
          placeholder="Minutes"
          inputMode="decimal"
          value={manualEntry.minutes}
          onChange={(e) => setManualEntry((m) => ({ ...m, minutes: e.target.value }))}
        />

        <button style={btnPrimary} onClick={() => addManual(currentJob.id)}>Add</button>
      </div>
    </div>

    <div style={card}>
      <div style={{ fontWeight: 900, marginBottom: 8 }}>Entries</div>

      {currentJob.entries.length === 0 ? (
        <div style={{ color: "#6b7280" }}>No entries yet.</div>
      ) : (
        <div style={{ display: "grid", gap: 6 }}>
          {currentJob.entries
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
                }}
              >
                <div style={{ fontWeight: 800 }}>{e.activity}</div>
                <div style={{ fontWeight: 900 }}>
                  {(Number(e.minutes) || 0).toFixed(2)} min
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  </div>
)}
      </div>
    </div>
  );
}