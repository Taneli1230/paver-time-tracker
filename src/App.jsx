import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const STORAGE_KEY = "paver_time_tracker_v1";

const DEFAULT_ACTIVITIES = [
  "Travel",
  "Mobilize / Unload",
  "Excavation",
  "hauling/dumping",
  "Pick up Material",
  "Base Prep (stone/compact)",
  "Screeding GEO_GRID",
  "Build Retaining wall",
  "Cap Installation",
  "Lay Pavers",
  "Cuts",
  "Edge Restraint",
  "PolySand / Compact",
  "Cleanup Daily",
  "Final grading",
  "Other / Issues",
];

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

const SQFT_BASED_ACTIVITIES = new Set([
  "Excavation",
  "Base Prep (stone/compact)",
  "Screeding GEO_GRID",
  "Lay Pavers",
  "Cuts",
  "Edge Restraint",
  "PolySand / Compact",
  "Build Retaining wall",
  "Cap Installation",
]);

function fmtClock(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(totalSec / 3600)).padStart(2, "0");
  const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
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

function localDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function startOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay(); // Sun=0, Mon=1, ... Fri=5
  const diffToFriday = (day - 5 + 7) % 7;
  d.setDate(d.getDate() - diffToFriday);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function shortUserId(userId) {
  if (!userId) return "Unknown";
  return userId.slice(0, 8);
}

export default function App() {
  const [state, setState] = useState({
    activities: DEFAULT_ACTIVITIES,
    jobs: [],
    activeTimer: null,
  });

  const [view, setView] = useState({ screen: "jobs", jobId: null });
  const [dashboardRows, setDashboardRows] = useState([]);
  const [jobProgressRows, setJobProgressRows] = useState([]);
  const [jobActivityRows, setJobActivityRows] = useState([]);
  const [completedJobs, setCompletedJobs] = useState([]);
  const [completedJobReport, setCompletedJobReport] = useState(null);
  const [completedJobActivities, setCompletedJobActivities] = useState([]);
  const [completedJobNotes, setCompletedJobNotes] = useState([]);

  const [analysisRows, setAnalysisRows] = useState([]);
  const [benchmarkRows, setBenchmarkRows] = useState([]);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [excludeDelayedBenchmarks, setExcludeDelayedBenchmarks] = useState(true);

  const [estimateInputs, setEstimateInputs] = useState({
    patio_sqft: "",
    wall_sqft: "",
    cap_lf: "",
  });
  const [estimateRows, setEstimateRows] = useState([]);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [excludeDelayedEstimate, setExcludeDelayedEstimate] = useState(true);
  const [estimateResult, setEstimateResult] = useState(null);
  const [crewMemberMap, setCrewMemberMap] = useState(new Map());

  const [newJob, setNewJob] = useState({
    name: "",
    patio_sqft: "",
    wall_sqft: "",
    cap_lf: "",
  });

  const [manualEntry, setManualEntry] = useState({
    activity: DEFAULT_ACTIVITIES[0],
    minutes: "",
  });

  const [jobNotes, setJobNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [addingNote, setAddingNote] = useState(false);
  const [newNoteType, setNewNoteType] = useState("General");
  const [newNoteText, setNewNoteText] = useState("");

  const [tick, setTick] = useState(Date.now());

  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [crewId, setCrewId] = useState(null);
  const [role, setRole] = useState("laborer");

  // Payroll clock state
  const [activeShift, setActiveShift] = useState(null);
  const [activeBreak, setActiveBreak] = useState(null);
  const [todayPayrollMinutes, setTodayPayrollMinutes] = useState(0);
  const [activeShiftBreakMinutes, setActiveShiftBreakMinutes] = useState(0);
  const [payrollRows, setPayrollRows] = useState([]);
  const [weeklyPayrollRows, setWeeklyPayrollRows] = useState([]);
  const [payrollLoading, setPayrollLoading] = useState(false);
const [payrollShiftRows, setPayrollShiftRows] = useState([]);

  useEffect(() => {
    if (!session) return;

    (async () => {
      const { data, error } = await supabase
        .from("crew_members")
        .select("crew_id, role")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (error) {
        console.error("crew lookup error", error);
        return;
      }

      if (!data) {
        console.warn("User is not assigned to a crew.");
        return;
      }

      setCrewId(data.crew_id);
      setRole(data.role || "laborer");
    })();
  }, [session]);

  useEffect(() => {
  if (!crewId) return;
  loadCrewMemberMap();
}, [crewId]);

  useEffect(() => {
    if (!crewId) return;

    (async () => {
      const { data: jobs, error: jErr } = await supabase
        .from("jobs")
        .select("*")
        .eq("crew_id", crewId)
        .is("completed_at", null)
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

      const totalsMap = new Map(
        (totals ?? []).map((r) => [r.job_id, Number(r.total_minutes) || 0])
      );

      setState((s) => ({
        ...s,
        jobs: (jobs ?? []).map((j) => ({
          ...j,
          entries: [],
          total_minutes: totalsMap.get(j.id) ?? 0,
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
    if (!session || !crewId) return;
    loadPayrollStatus();
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

  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  const activeTimer = state.activeTimer;

  const jobsById = useMemo(() => {
    const m = new Map();
    for (const j of state.jobs) m.set(j.id, j);
    return m;
  }, [state.jobs]);

  const currentJob = view.screen === "job" ? jobsById.get(view.jobId) : null;
  const isManager = role === "owner" || role === "supervisor";

  const runningElapsedMs = useMemo(() => {
    if (!activeTimer) return 0;
    return tick - activeTimer.startedAt;
  }, [activeTimer, tick]);

  const todayPayrollDisplayMinutes = useMemo(() => {
    let total = Number(todayPayrollMinutes || 0);

    if (
      activeShift &&
      activeShift.clock_in_at &&
      activeShift.work_date === localDateString()
    ) {
      const clockInMs = new Date(activeShift.clock_in_at).getTime();
      const grossMinutes = Math.max(0, (tick - clockInMs) / 60000);

      let breakMinutes = Number(activeShiftBreakMinutes || 0);

      if (activeBreak && !activeBreak.break_in_at && activeBreak.break_out_at) {
        breakMinutes += Math.max(
          0,
          (tick - new Date(activeBreak.break_out_at).getTime()) / 60000
        );
      }

      total += Math.max(0, grossMinutes - breakMinutes);
    }

    return total;
  }, [todayPayrollMinutes, activeShift, activeBreak, activeShiftBreakMinutes, tick]);

  const analysisSummary = useMemo(() => {
    const rows = excludeDelayedBenchmarks
      ? analysisRows.filter((r) => !r.has_delay)
      : analysisRows;

    const completedCount = analysisRows.length;
    const cleanCount = analysisRows.filter((r) => !r.has_delay).length;
    const delayedCount = analysisRows.filter((r) => r.has_delay).length;

    const avgHours =
      rows.length > 0
        ? rows.reduce((sum, r) => sum + (Number(r.total_hours) || 0), 0) /
          rows.length
        : 0;

    const avgCleanHours =
      cleanCount > 0
        ? analysisRows
            .filter((r) => !r.has_delay)
            .reduce((sum, r) => sum + (Number(r.total_hours) || 0), 0) /
          cleanCount
        : 0;

    const avgDelayedHours =
      delayedCount > 0
        ? analysisRows
            .filter((r) => r.has_delay)
            .reduce((sum, r) => sum + (Number(r.total_hours) || 0), 0) /
          delayedCount
        : 0;

    return {
      completedCount,
      cleanCount,
      delayedCount,
      avgHours,
      avgCleanHours,
      avgDelayedHours,
    };
  }, [analysisRows, excludeDelayedBenchmarks]);

  const filteredAnalysisRows = useMemo(() => {
    return excludeDelayedBenchmarks
      ? analysisRows.filter((r) => !r.has_delay)
      : analysisRows;
  }, [analysisRows, excludeDelayedBenchmarks]);

  const benchmarkSummaryRows = useMemo(() => {
    if (filteredAnalysisRows.length === 0) return [];

    const jobMap = new Map(filteredAnalysisRows.map((r) => [r.job_id, r]));
    const grouped = new Map();

    for (const row of benchmarkRows) {
      const job = jobMap.get(row.job_id);
      if (!job) continue;

      const activity = row.activity || "Unknown";
      const totalHours = Number(row.total_hours || 0);

      if (!grouped.has(activity)) {
        grouped.set(activity, {
          activity,
          total_hours: 0,
          job_count: 0,
          total_minutes_per_sqft_sum: 0,
          sqft_rate_count: 0,
        });
      }

      const g = grouped.get(activity);
      g.total_hours += totalHours;
      g.job_count += 1;

      if (SQFT_BASED_ACTIVITIES.has(activity)) {
        const patioSqft = Number(job.patio_sqft || 0);
        const wallSqft = Number(job.wall_sqft || 0);
        const baseSqft =
          activity === "Build Retaining wall"
            ? wallSqft
            : patioSqft + wallSqft;

        if (baseSqft > 0) {
          const minsPerSqft = (totalHours * 60) / baseSqft;
          g.total_minutes_per_sqft_sum += minsPerSqft;
          g.sqft_rate_count += 1;
        }
      }
    }

    return Array.from(grouped.values())
      .map((g) => ({
        activity: g.activity,
        total_hours: g.total_hours,
        avg_hours_per_job: g.job_count > 0 ? g.total_hours / g.job_count : 0,
        avg_min_per_sqft:
          g.sqft_rate_count > 0
            ? g.total_minutes_per_sqft_sum / g.sqft_rate_count
            : null,
      }))
      .sort((a, b) => b.total_hours - a.total_hours);
  }, [benchmarkRows, filteredAnalysisRows]);

  function similarityScore(target, job) {
    const dims = [
      ["patio_sqft", Number(target.patio_sqft || 0), Number(job.patio_sqft || 0)],
      ["wall_sqft", Number(target.wall_sqft || 0), Number(job.wall_sqft || 0)],
      ["cap_lf", Number(target.cap_lf || 0), Number(job.cap_lf || 0)],
    ];

    let totalPenalty = 0;

    for (const [, targetVal, jobVal] of dims) {
      if (targetVal === 0 && jobVal === 0) continue;

      const base = Math.max(targetVal, jobVal, 1);
      const diff = Math.abs(targetVal - jobVal) / base;
      totalPenalty += diff;
    }

    return 1 / (1 + totalPenalty);
  }

  function goJobs() {
    setView({ screen: "jobs", jobId: null });
    setJobNotes([]);
    setNewNoteType("General");
    setNewNoteText("");
    setCompletedJobReport(null);
    setCompletedJobActivities([]);
    setCompletedJobNotes([]);
    setEstimateResult(null);
  }

  async function loadPayrollStatus() {
    if (!session || !crewId) return;

    const today = localDateString();

    const { data: shift, error: shiftError } = await supabase
      .from("time_shifts")
      .select("*")
      .eq("user_id", session.user.id)
      .in("status", ["clocked_in", "on_break"])
      .order("clock_in_at", { ascending: false })
      .maybeSingle();

    if (shiftError) {
      console.error("load active shift error", shiftError);
      return;
    }

    setActiveShift(shift ?? null);

    const { data: shiftsToday, error: totalError } = await supabase
      .from("time_shifts")
      .select("id,total_work_minutes,status,clock_in_at,work_date")
      .eq("user_id", session.user.id)
      .eq("work_date", today);

    if (totalError) {
      console.error("load today payroll totals error", totalError);
      return;
    }

    const storedTotalMinutes = (shiftsToday ?? []).reduce(
      (sum, s) => sum + Number(s.total_work_minutes || 0),
      0
    );

    setTodayPayrollMinutes(storedTotalMinutes);

    if (!shift) {
      setActiveBreak(null);
      setActiveShiftBreakMinutes(0);
      return;
    }

    const { data: breaks, error: breaksError } = await supabase
      .from("time_breaks")
      .select("*")
      .eq("shift_id", shift.id)
      .order("break_out_at", { ascending: false });

    if (breaksError) {
      console.error("load shift breaks error", breaksError);
      setActiveBreak(null);
      setActiveShiftBreakMinutes(0);
      return;
    }

    const activeOpenBreak =
      (breaks ?? []).find((b) => !b.break_in_at) ?? null;

    const completedBreakMinutes = (breaks ?? []).reduce(
      (sum, b) => sum + Number(b.total_break_minutes || 0),
      0
    );

    setActiveBreak(activeOpenBreak);
    setActiveShiftBreakMinutes(completedBreakMinutes);
  }
async function openPayrollShiftEditor() {
  if (!crewId) {
    alert("Your account is not assigned to a crew yet.");
    return;
  }

  const weekStart = startOfWeek(new Date());
  const weekDates = Array.from({ length: 7 }, (_, i) =>
    localDateString(addDays(weekStart, i))
  );

  const { data: crewMembers, error: crewError } = await supabase
    .from("crew_members")
    .select("user_id, display_name")
    .eq("crew_id", crewId);

  if (crewError) {
    console.error("crew member load error", crewError);
    return alert(crewError.message);
  }

  const nameMap = new Map();
  for (const row of crewMembers ?? []) {
    nameMap.set(String(row.user_id), row.display_name || "Unknown Worker");
  }

  const { data: shifts, error } = await supabase
    .from("time_shifts")
    .select("*")
    .eq("crew_id", crewId)
    .gte("work_date", weekDates[0])
    .lte("work_date", weekDates[6])
    .order("work_date", { ascending: false })
    .order("clock_in_at", { ascending: false });

  if (error) {
    console.error("payroll shift editor load error", error);
    return alert(error.message);
  }

  const rows = (shifts ?? []).map((row) => ({
    ...row,
    display_name:
      nameMap.get(String(row.user_id)) || `Worker ${shortUserId(row.user_id)}`,
  }));

  setPayrollShiftRows(rows);
}

async function editPayrollShift(row) {
  if (!row?.id) {
    alert("No shift selected.");
    return;
  }

  const currentClockIn = row.clock_in_at
    ? new Date(row.clock_in_at).toISOString().slice(0, 16)
    : "";
  const currentClockOut = row.clock_out_at
    ? new Date(row.clock_out_at).toISOString().slice(0, 16)
    : "";
  const currentMinutes = String(Number(row.total_work_minutes || 0));
  const currentStatus = row.status || "clocked_out";

  const clockInInput = window.prompt(
    `Edit Clock In for ${row.display_name}\nUse format: YYYY-MM-DDTHH:MM`,
    currentClockIn
  );
  if (clockInInput === null) return;

  const clockOutInput = window.prompt(
    `Edit Clock Out for ${row.display_name}\nUse format: YYYY-MM-DDTHH:MM\nLeave blank if still open`,
    currentClockOut
  );
  if (clockOutInput === null) return;

  const minutesInput = window.prompt(
    `Edit Total Work Minutes for ${row.display_name}`,
    currentMinutes
  );
  if (minutesInput === null) return;

  const statusInput = window.prompt(
    `Edit Status for ${row.display_name}\nUse one of: clocked_in, on_break, clocked_out`,
    currentStatus
  );
  if (statusInput === null) return;

  const totalMinutes = Number(minutesInput);
  if (Number.isNaN(totalMinutes) || totalMinutes < 0) {
    alert("Enter valid total work minutes.");
    return;
  }

  const validStatuses = ["clocked_in", "on_break", "clocked_out"];
  if (!validStatuses.includes(statusInput)) {
    alert("Status must be clocked_in, on_break, or clocked_out.");
    return;
  }

  const patch = {
    clock_in_at: clockInInput ? new Date(clockInInput).toISOString() : null,
    clock_out_at: clockOutInput ? new Date(clockOutInput).toISOString() : null,
    total_work_minutes: totalMinutes,
    status: statusInput,
    work_date: row.work_date || null,
  };

  const { error } = await supabase
    .from("time_shifts")
    .update(patch)
    .eq("id", row.id);

  if (error) {
    console.error("edit payroll shift error", error);
    alert(error.message);
    return;
  }

  await openPayroll();
  alert("Payroll shift updated.");
}

  async function loadCrewMemberMap() {
  if (!crewId) return;

  const { data, error } = await supabase
    .from("crew_members")
    .select("user_id, display_name")
    .eq("crew_id", crewId);

  if (error) {
    console.error("crew member map load error", error);
    return;
  }

  const map = new Map();

  for (const row of data ?? []) {
    map.set(row.user_id, row.display_name || "Unknown Worker");
  }
console.log("crew_members rows", data);
console.log("crew member map entries", Array.from(map.entries()));

  setCrewMemberMap(map);
}

  async function clockIn() {
    if (!session) return alert("Not logged in");
    if (!crewId) return alert("Crew not loaded yet.");
    if (activeShift) return alert("Already clocked in.");

    const nowIso = new Date().toISOString();
    const today = localDateString();

    const { data, error } = await supabase
      .from("time_shifts")
      .insert([
        {
          user_id: session.user.id,
          crew_id: crewId,
          work_date: today,
          clock_in_at: nowIso,
          status: "clocked_in",
          total_work_minutes: 0,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("clock in error", error);
      return alert(error.message);
    }

    setActiveShift(data);
    setActiveBreak(null);
    setActiveShiftBreakMinutes(0);
    await loadPayrollStatus();
  }
async function clockOut() {
  if (!activeShift) return alert("Not clocked in.");

  const nowIso = new Date().toISOString();
  let totalBreakMinutes = Number(activeShiftBreakMinutes || 0);

  if (activeBreak && activeBreak.break_out_at && !activeBreak.break_in_at) {
    const extraBreakMinutes = Math.max(
      0,
      (Date.now() - new Date(activeBreak.break_out_at).getTime()) / 60000
    );

    const finalBreakMinutes =
      Number(activeBreak.total_break_minutes || 0) + extraBreakMinutes;

    const { error: breakError } = await supabase
      .from("time_breaks")
      .update({
        break_in_at: nowIso,
        total_break_minutes: finalBreakMinutes,
      })
      .eq("id", activeBreak.id);

    if (breakError) {
      console.error("clock out break close error", breakError);
      return alert(breakError.message);
    }

    totalBreakMinutes += extraBreakMinutes;
  }

  const grossMinutes = Math.max(
    0,
    (Date.now() - new Date(activeShift.clock_in_at).getTime()) / 60000
  );

  const totalWorkMinutes = Math.max(0, grossMinutes - totalBreakMinutes);

  const { error } = await supabase
    .from("time_shifts")
    .update({
      clock_out_at: nowIso,
      status: "clocked_out",
      total_work_minutes: totalWorkMinutes,
    })
    .eq("id", activeShift.id);

  if (error) {
    console.error("clock out error", error);
    return alert(error.message);
  }

  setActiveShift(null);
  setActiveBreak(null);
  setActiveShiftBreakMinutes(0);
  await loadPayrollStatus();
}
  async function lunchOut() {
    if (!activeShift) return alert("Not clocked in.");
    if (activeShift.status === "on_break") return alert("Already on lunch.");

    if (activeTimer) {
      alert(
        "You still have a job timer running. Payroll clock and job timer are separate, but stop the job timer if you want clean production data."
      );
    }

    const nowIso = new Date().toISOString();

    const { data: updatedShift, error: shiftError } = await supabase
      .from("time_shifts")
      .update({ status: "on_break" })
      .eq("id", activeShift.id)
      .select()
      .single();

    if (shiftError) {
      console.error("lunch out shift error", shiftError);
      return alert(shiftError.message);
    }

    const { data: brk, error: breakError } = await supabase
      .from("time_breaks")
      .insert([
        {
          shift_id: activeShift.id,
          break_out_at: nowIso,
          total_break_minutes: 0,
        },
      ])
      .select()
      .single();

    if (breakError) {
      console.error("lunch out break error", breakError);
      return alert(breakError.message);
    }

    setActiveShift(updatedShift);
    setActiveBreak(brk);
  }

 async function lunchIn() {
  if (!activeShift || activeShift.status !== "on_break") {
    return alert("Not currently on lunch.");
  }

  const nowIso = new Date().toISOString();

  // If there is no active break row, recover gracefully by resetting shift status.
  if (!activeBreak) {
    const { data: updatedShift, error: recoverError } = await supabase
      .from("time_shifts")
      .update({ status: "clocked_in" })
      .eq("id", activeShift.id)
      .select()
      .single();

    if (recoverError) {
      console.error("lunch recovery error", recoverError);
      return alert(recoverError.message);
    }

    setActiveShift(updatedShift);
    setActiveBreak(null);
    await loadPayrollStatus();
    alert("Lunch was recovered. No active break record was found, so the shift was returned to clocked in.");
    return;
  }

  const now = Date.now();
  const breakOut = new Date(activeBreak.break_out_at).getTime();
  const breakMinutes = (now - breakOut) / 60000;

  const { error: breakError } = await supabase
    .from("time_breaks")
    .update({
      break_in_at: nowIso,
      total_break_minutes: breakMinutes,
    })
    .eq("id", activeBreak.id);

  if (breakError) {
    console.error("lunch in break error", breakError);
    return alert(breakError.message);
  }

  const { data: updatedShift, error: shiftError } = await supabase
    .from("time_shifts")
    .update({ status: "clocked_in" })
    .eq("id", activeShift.id)
    .select()
    .single();

  if (shiftError) {
    console.error("lunch in shift error", shiftError);
    return alert(shiftError.message);
  }

  setActiveShift(updatedShift);
  setActiveBreak(null);
  await loadPayrollStatus();
}

async function openPayroll() {
  if (!crewId) {
    alert("Your account is not assigned to a crew yet.");
    return;
  }

  setView({ screen: "payroll", jobId: null });
  setPayrollLoading(true);

  const weekStart = startOfWeek(new Date());
  const weekDates = Array.from({ length: 7 }, (_, i) =>
    localDateString(addDays(weekStart, i))
  );

  const { data: crewMembers, error: crewError } = await supabase
    .from("crew_members")
    .select("user_id, display_name")
    .eq("crew_id", crewId);

  if (crewError) {
    console.error("crew member load error", crewError);
    alert(crewError.message);
    setPayrollLoading(false);
    return;
  }

  const nameMap = new Map();
  for (const row of crewMembers ?? []) {
    nameMap.set(String(row.user_id), row.display_name || "Unknown Worker");
  }

  const { data: activeShiftRows, error: activeError } = await supabase
    .from("time_shifts")
    .select("*")
    .eq("crew_id", crewId)
    .in("status", ["clocked_in", "on_break"])
    .order("clock_in_at", { ascending: true });

  if (activeError) {
    console.error("active payroll load error", activeError);
    alert(activeError.message);
    setPayrollLoading(false);
    return;
  }

  const { data: weekShiftRows, error: weekError } = await supabase
    .from("time_shifts")
    .select("*")
    .eq("crew_id", crewId)
    .gte("work_date", weekDates[0])
    .lte("work_date", weekDates[6])
    .order("work_date", { ascending: true })
    .order("clock_in_at", { ascending: true });

  if (weekError) {
    console.error("weekly payroll load error", weekError);
    alert(weekError.message);
    setPayrollLoading(false);
    return;
  }

  const activeWithNames = (activeShiftRows ?? []).map((row) => ({
    ...row,
    display_name:
      nameMap.get(String(row.user_id)) || `Worker ${shortUserId(row.user_id)}`,
  }));

  console.log("active payroll rows with names", activeWithNames);
  setPayrollRows(activeWithNames);

  const grouped = new Map();

  for (const row of weekShiftRows ?? []) {
    const key = String(row.user_id);

    if (!grouped.has(key)) {
      grouped.set(key, {
        user_id: row.user_id,
        display_name:
          nameMap.get(key) || `Worker ${shortUserId(row.user_id)}`,
        days: Object.fromEntries(weekDates.map((d) => [d, 0])),
        total_minutes: 0,
      });
    }

    const g = grouped.get(key);
    const workDate = row.work_date;
    const minutes = Number(row.total_work_minutes || 0);

    if (g.days[workDate] == null) g.days[workDate] = 0;
    g.days[workDate] += minutes;
    g.total_minutes += minutes;
  }

  const groupedRows = Array.from(grouped.values());
  console.log("weekly payroll grouped rows", groupedRows);

  setWeeklyPayrollRows(groupedRows);
  setPayrollLoading(false);
  await openPayrollShiftEditor();
}

  async function openBenchmarks() {
    if (!crewId) {
      alert("Your account is not assigned to a crew yet.");
      return;
    }

    setView({ screen: "analysis", jobId: null });
    setAnalysisLoading(true);

    const { data: jobs, error: jobsError } = await supabase
      .from("completed_job_analysis")
      .select("*")
      .eq("crew_id", crewId)
      .order("completed_at", { ascending: false });

    if (jobsError) {
      console.error("completed_job_analysis load error", jobsError);
      alert(jobsError.message);
      setAnalysisLoading(false);
      return;
    }

    const jobIds = (jobs ?? []).map((j) => j.job_id);

    let activityRows = [];
    if (jobIds.length > 0) {
      const { data: activityData, error: activityError } = await supabase
        .from("job_activity_breakdown")
        .select("*")
        .in("job_id", jobIds);

      if (activityError) {
        console.error("benchmark activity load error", activityError);
        alert(activityError.message);
        setAnalysisLoading(false);
        return;
      }

      activityRows = activityData ?? [];
    }

    setAnalysisRows(jobs ?? []);
    setBenchmarkRows(activityRows);
    setAnalysisLoading(false);
  }

  async function openEstimator() {
    if (!crewId) {
      alert("Your account is not assigned to a crew yet.");
      return;
    }

    setView({ screen: "estimator", jobId: null });
    setEstimateLoading(true);
    setEstimateResult(null);

    const { data, error } = await supabase
      .from("completed_job_analysis")
      .select("*")
      .eq("crew_id", crewId)
      .order("completed_at", { ascending: false });

    if (error) {
      console.error("estimator load error", error);
      alert(error.message);
      setEstimateLoading(false);
      return;
    }

    setEstimateRows(data ?? []);
    setEstimateLoading(false);
  }

  function calculateEstimate() {
    const patioSqft = Number(estimateInputs.patio_sqft || 0);
    const wallSqft = Number(estimateInputs.wall_sqft || 0);
    const capLf = Number(estimateInputs.cap_lf || 0);

    if (patioSqft <= 0 && wallSqft <= 0 && capLf <= 0) {
      alert("Enter at least one measurement greater than 0.");
      return;
    }

    let rows = [...estimateRows];

    if (excludeDelayedEstimate) {
      rows = rows.filter((r) => !r.has_delay);
    }

    if (rows.length === 0) {
      alert("No completed jobs available for this estimator filter.");
      return;
    }

    const target = {
      patio_sqft: patioSqft,
      wall_sqft: wallSqft,
      cap_lf: capLf,
    };

    const scored = rows
      .map((job) => ({
        ...job,
        similarity: similarityScore(target, job),
      }))
      .sort((a, b) => b.similarity - a.similarity);

    const topMatches = scored.slice(0, Math.min(5, scored.length));

    const totalWeight = topMatches.reduce((sum, j) => sum + j.similarity, 0);

    const likelyHours =
      totalWeight > 0
        ? topMatches.reduce(
            (sum, j) => sum + Number(j.total_hours || 0) * j.similarity,
            0
          ) / totalWeight
        : 0;

    const matchedHours = topMatches.map((j) => Number(j.total_hours || 0));
    const lowHours =
      matchedHours.length > 0 ? Math.min(...matchedHours) : likelyHours * 0.85;
    const highHours =
      matchedHours.length > 0 ? Math.max(...matchedHours) : likelyHours * 1.15;

    setEstimateResult({
      input: target,
      low_hours: lowHours,
      likely_hours: likelyHours,
      high_hours: highHours,
      match_count: topMatches.length,
      matches: topMatches,
    });
  }

  async function openJob(jobId) {
    setView({ screen: "job", jobId });
    setNotesLoading(true);

    const [
      { data: entriesData, error: entriesError },
      { data: notesData, error: notesError },
    ] = await Promise.all([
      supabase
        .from("entries")
        .select("*")
        .eq("job_id", jobId)
        .order("created_at", { ascending: false }),
      supabase
        .from("job_notes")
        .select("*")
        .eq("job_id", jobId)
        .order("created_at", { ascending: false }),
    ]);

    if (entriesError) console.error("entries load error", entriesError);
    if (notesError) console.error("notes load error", notesError);

    setState((s) => ({
      ...s,
      jobs: s.jobs.map((j) =>
        j.id === jobId ? { ...j, entries: entriesData ?? [] } : j
      ),
    }));

    setJobNotes(notesData ?? []);
    setNotesLoading(false);
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
    setCompletedJobReport(null);
    setCompletedJobActivities([]);
    setCompletedJobNotes([]);

    const { data, error } = await supabase
      .from("completed_job_progress_dashboard")
      .select("*")
      .eq("crew_id", crewId)
      .order("completed_at", { ascending: false });

    if (error) {
      console.error("completed jobs load error", error);
      alert(error.message);
      return;
    }

    setCompletedJobs(data ?? []);
  }

  async function openCompletedJobReport(job) {
    const jobId = job.job_id || job.id;

    const [
      { data: entries, error: entriesError },
      { data: activities, error: activitiesError },
      { data: notes, error: notesError },
    ] = await Promise.all([
      supabase.from("entries").select("*").eq("job_id", jobId),
      supabase
        .from("job_activity_breakdown")
        .select("*")
        .eq("job_id", jobId)
        .order("activity", { ascending: true }),
      supabase
        .from("job_notes")
        .select("*")
        .eq("job_id", jobId)
        .order("created_at", { ascending: false }),
    ]);

    if (entriesError) return alert(entriesError.message);
    if (activitiesError) return alert(activitiesError.message);
    if (notesError) return alert(notesError.message);

    const totalMinutes = (entries ?? []).reduce(
      (sum, e) => sum + (Number(e.minutes) || 0),
      0
    );
    const totalHours = totalMinutes / 60;
    const sqftBase = Number(job.patio_sqft || 0) + Number(job.wall_sqft || 0);

    const minPerSqft = sqftBase > 0 ? totalMinutes / sqftBase : 0;

    setCompletedJobReport({
      ...job,
      total_minutes: totalMinutes,
      total_hours: totalHours,
      min_per_sqft: minPerSqft,
    });

    setCompletedJobActivities(activities ?? []);
    setCompletedJobNotes(notes ?? []);
    setView({ screen: "completedReport", jobId });
  }

  async function addJob() {
    const name = newJob.name.trim() || "Untitled Job";
    const patioSqft = Number(String(newJob.patio_sqft).trim() || 0);
    const wallSqft = Number(String(newJob.wall_sqft).trim() || 0);
    const capLf = Number(String(newJob.cap_lf).trim() || 0);

    if (patioSqft <= 0 && wallSqft <= 0 && capLf <= 0) {
      alert("Enter at least one measurement greater than 0.");
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
          patio_sqft: patioSqft || 0,
          wall_sqft: wallSqft || 0,
          cap_lf: capLf || 0,
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
      jobs: [{ ...data, entries: [], total_minutes: 0 }, ...s.jobs],
    }));

    setNewJob({
      name: "",
      patio_sqft: "",
      wall_sqft: "",
      cap_lf: "",
    });
  }

  async function updateJob(jobId, patch) {
    setState((s) => ({
      ...s,
      jobs: s.jobs.map((j) => (j.id === jobId ? { ...j, ...patch } : j)),
    }));

    const { error } = await supabase.from("jobs").update(patch).eq("id", jobId);

    if (error) {
      console.error("job update error", error);
      alert(error.message);
    }
  }

  async function addManual(jobId) {
    if (!session) return alert("Not logged in");
    if (!crewId) return alert("Crew not loaded yet.");

    const minutes = Number(manualEntry.minutes);
    if (!minutes || minutes <= 0) return alert("Enter valid minutes.");

    const startedAtIso = new Date().toISOString();
    const endedAtIso = new Date().toISOString();

    const { data, error } = await supabase
      .from("entries")
      .insert([
        {
          crew_id: crewId,
          job_id: jobId,
          worker_id: session.user.id,
          activity: manualEntry.activity,
          minutes,
          started_at: startedAtIso,
          ended_at: endedAtIso,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("manual entry insert error", error);
      alert(error.message);
      return;
    }

    setState((s) => ({
      ...s,
      jobs: s.jobs.map((j) =>
        j.id === jobId
          ? {
              ...j,
              entries: [data, ...(j.entries || [])],
              total_minutes: (Number(j.total_minutes) || 0) + minutes,
            }
          : j
      ),
    }));

    setManualEntry({
      activity: DEFAULT_ACTIVITIES[0],
      minutes: "",
    });
  }

  async function addJobNote(jobId) {
    if (!session) return alert("Not logged in");
    if (!crewId) return alert("Crew not loaded yet.");
    if (!newNoteText.trim()) return alert("Enter a note first.");

    setAddingNote(true);

    const { data, error } = await supabase
      .from("job_notes")
      .insert([
        {
          job_id: jobId,
          crew_id: crewId,
          user_id: session.user.id,
          note_type: newNoteType,
          note_text: newNoteText.trim(),
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("job note insert error", error);
      alert(error.message);
      setAddingNote(false);
      return;
    }

    setJobNotes((prev) => [data, ...prev]);
    setNewNoteType("General");
    setNewNoteText("");
    setAddingNote(false);
  }

  async function startTimer(jobId, activity) {
    if (!session) return alert("Not logged in");
    if (!crewId) return alert("Crew not loaded yet.");

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

    if (entryErr) return alert(entryErr.message);

    const { error: timerErr } = await supabase.from("active_timers").upsert({
      worker_id: session.user.id,
      crew_id: crewId,
      job_id: jobId,
      activity,
      started_at: startedISO,
      entry_id: entry.id,
    });

    if (timerErr) return alert(timerErr.message);

    setState((s) => ({
      ...s,
      activeTimer: {
        jobId,
        activity,
        startedAt: new Date(startedISO).getTime(),
        entryId: entry.id,
      },
      jobs: s.jobs.map((j) =>
        j.id === jobId ? { ...j, entries: [entry, ...(j.entries || [])] } : j
      ),
    }));
  }

  async function stopTimer() {
    if (!session || !crewId || !state.activeTimer) return;

    const { data: timer, error } = await supabase
      .from("active_timers")
      .select("*")
      .eq("worker_id", session.user.id)
      .maybeSingle();

    if (error) return alert(error.message);
    if (!timer) return;

    const started = new Date(timer.started_at).getTime();
    const ended = Date.now();
    const minutes = (ended - started) / 60000;
    const endedAtIso = new Date().toISOString();

    const { data: updatedEntry, error: updErr } = await supabase
      .from("entries")
      .update({
        minutes,
        ended_at: endedAtIso,
      })
      .eq("id", timer.entry_id)
      .select()
      .single();

    if (updErr) return alert(updErr.message);

    const { error: delErr } = await supabase
      .from("active_timers")
      .delete()
      .eq("worker_id", session.user.id);

    if (delErr) return alert(delErr.message);

    setState((s) => ({
      ...s,
      activeTimer: null,
      jobs: s.jobs.map((j) => {
        if (j.id !== timer.job_id) return j;

        const existingEntries = Array.isArray(j.entries) ? j.entries : [];
        const nextEntries = existingEntries.map((e) =>
          e.id === updatedEntry.id ? updatedEntry : e
        );

        return {
          ...j,
          entries: nextEntries,
          total_minutes:
            (Number(j.total_minutes) || 0) + (Number(updatedEntry.minutes) || 0),
        };
      }),
    }));
  }

  async function supervisorStopTimer(timerRow) {
    if (!isManager) return alert("Only managers can stop crew timers.");

    const started = new Date(timerRow.started_at).getTime();
    const ended = Date.now();
    const minutes = (ended - started) / 60000;
    const endedAtIso = new Date().toISOString();

    const { data: updatedEntry, error: updErr } = await supabase
      .from("entries")
      .update({
        minutes,
        ended_at: endedAtIso,
      })
      .eq("id", timerRow.entry_id)
      .select()
      .single();

    if (updErr) return alert(updErr.message);

    const { error: delErr } = await supabase
      .from("active_timers")
      .delete()
      .eq("worker_id", timerRow.worker_id);

    if (delErr) return alert(delErr.message);

    setDashboardRows((rows) =>
      rows.filter((r) => !(r.worker_id === timerRow.worker_id))
    );

    setState((s) => ({
      ...s,
      jobs: s.jobs.map((j) => {
        if (j.id !== timerRow.job_id) return j;

        const existingEntries = Array.isArray(j.entries) ? j.entries : [];
        const existingIndex = existingEntries.findIndex(
          (e) => e.id === updatedEntry.id
        );

        let nextEntries;
        if (existingIndex >= 0) {
          nextEntries = existingEntries.map((e) =>
            e.id === updatedEntry.id ? updatedEntry : e
          );
        } else {
          nextEntries = [updatedEntry, ...existingEntries];
        }

        return {
          ...j,
          entries: nextEntries,
        };
      }),
    }));
  }

  function exportCSV() {
    const jobRows = [
      [
        "Job Name",
        "Patio Sqft",
        "Wall Sqft",
        "Cap LF",
        "Total Hours",
        "Created At",
      ],
      ...state.jobs.map((j) => {
        const totalM = Number(j.total_minutes) || 0;
        const hrs = totalM / 60;

        return [
          j.name,
          j.patio_sqft ?? 0,
          j.wall_sqft ?? 0,
          j.cap_lf ?? 0,
          hrs.toFixed(2),
          j.created_at ?? "",
        ];
      }),
    ];

    const entryRows = [
      [
        "Job Name",
        "Patio Sqft",
        "Wall Sqft",
        "Cap LF",
        "Activity",
        "Minutes",
        "Hours",
        "Started At",
        "Ended At",
      ],
      ...state.jobs.flatMap((j) =>
        (j.entries || []).map((e) => [
          j.name,
          j.patio_sqft ?? 0,
          j.wall_sqft ?? 0,
          j.cap_lf ?? 0,
          e.activity,
          (e.minutes ?? 0).toFixed(2),
          ((e.minutes ?? 0) / 60).toFixed(2),
          e.started_at ?? "",
          e.ended_at ?? "",
        ])
      ),
    ];

    const csv = toCSV(jobRows) + "\n\n" + toCSV(entryRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `paver_time_tracker_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const payrollWeekDates = useMemo(() => {
    const weekStart = startOfWeek(new Date());
    return Array.from({ length: 7 }, (_, i) =>
      localDateString(addDays(weekStart, i))
    );
  }, []);

  const page = {
    maxWidth: 1100,
    margin: "0 auto",
    padding: 16,
    fontFamily:
      "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
    color: "#111827",
  };

  const card = {
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 14,
    background: "white",
    color: "#111827",
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
  };

  const btn = {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #d1d5db",
    background: "white",
    cursor: "pointer",
    fontWeight: 600,
  };

  const btnPrimary = {
    ...btn,
    border: "1px solid #111827",
    background: "#111827",
    color: "white",
  };

  const input = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #d1d5db",
    fontSize: 16,
  };

  if (!session) {
    return (
      <div style={{ background: "#f8fafc", minHeight: "100vh" }}>
        <div
          style={{
            maxWidth: 520,
            margin: "0 auto",
            padding: 24,
            fontFamily: page.fontFamily,
          }}
        >
          <div style={{ ...card, textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 6 }}>
              Login to Time Tracker
            </div>
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

            <div style={{ height: 10 }} />

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
                if (!email.trim() || !password) {
                  return alert("Enter email + password.");
                }

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
                if (!email.trim() || !password) {
                  return alert("Enter email + password.");
                }

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
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>
              Paver Patio Time Tracker (MVP)
            </div>
            <div style={{ color: "#6b7280", fontSize: 13 }}>
              Track activities → get accurate hours per sqft
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            {isManager && (
              <button style={btn} onClick={openDashboard}>
                Dashboard
              </button>
            )}
            {isManager && (
              <button style={btn} onClick={openCompletedJobs}>
                Completed Jobs
              </button>
            )}
            {isManager && (
              <button style={btn} onClick={openBenchmarks}>
                Benchmarks
              </button>
            )}
            {isManager && (
              <button style={btn} onClick={openEstimator}>
                Estimator
              </button>
            )}
            {isManager && (
              <button style={btn} onClick={openPayroll}>
                Payroll
              </button>
            )}
            {isManager && (
              <button style={btn} onClick={exportCSV}>
                Export CSV
              </button>
            )}
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
              <div
                style={{
                  color: "#6b7280",
                  fontWeight: 700,
                  alignSelf: "center",
                }}
              >
                No timer running
              </div>
            )}
          </div>
        </header>

        <div style={{ height: 14 }} />

        <div style={card}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Payroll Clock</div>

          <div style={{ color: "#6b7280", marginBottom: 8 }}>
            {activeShift
              ? activeShift.status === "on_break"
                ? `On lunch since ${new Date(
                    activeBreak?.break_out_at || activeShift.clock_in_at
                  ).toLocaleTimeString()}`
                : `Clocked in at ${new Date(
                    activeShift.clock_in_at
                  ).toLocaleTimeString()}`
              : "Currently clocked out"}
          </div>

          <div style={{ color: "#6b7280", marginBottom: 10 }}>
            Today: {(todayPayrollDisplayMinutes / 60).toFixed(2)} hrs
          </div>

          {activeTimer && activeShift && (
            <div style={{ color: "#6b7280", fontSize: 12, marginBottom: 10 }}>
              Job timer is running separately from payroll clock.
            </div>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {!activeShift && (
              <button style={btnPrimary} onClick={clockIn}>
                Clock In
              </button>
            )}

            {activeShift && activeShift.status === "clocked_in" && (
              <>
                <button style={btn} onClick={lunchOut}>
                  Lunch Out
                </button>
                <button style={btnPrimary} onClick={clockOut}>
                  Clock Out
                </button>
              </>
            )}

            {activeShift && activeShift.status === "on_break" && (
              <button style={btnPrimary} onClick={lunchIn}>
                Lunch In
              </button>
            )}
          </div>
        </div>

        <div style={{ height: 14 }} />

        {view.screen === "jobs" && (
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
        )}

        {view.screen === "payroll" && isManager && (
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
                  <div style={{ fontWeight: 900, marginBottom: 10 }}>
                    Weekly Payroll Totals
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
        )}

        {view.screen === "analysis" && isManager && (
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
                    <div style={{ color: "#6b7280", fontSize: 13 }}>
                      Completed Jobs
                    </div>
                    <div style={{ fontWeight: 900, fontSize: 24 }}>
                      {analysisSummary.completedCount}
                    </div>
                  </div>
                  <div style={card}>
                    <div style={{ color: "#6b7280", fontSize: 13 }}>
                      Clean Jobs
                    </div>
                    <div style={{ fontWeight: 900, fontSize: 24 }}>
                      {analysisSummary.cleanCount}
                    </div>
                  </div>
                  <div style={card}>
                    <div style={{ color: "#6b7280", fontSize: 13 }}>
                      Delayed Jobs
                    </div>
                    <div style={{ fontWeight: 900, fontSize: 24 }}>
                      {analysisSummary.delayedCount}
                    </div>
                  </div>
                  <div style={card}>
                    <div style={{ color: "#6b7280", fontSize: 13 }}>
                      Avg Hours (current filter)
                    </div>
                    <div style={{ fontWeight: 900, fontSize: 24 }}>
                      {analysisSummary.avgHours.toFixed(2)}
                    </div>
                  </div>
                  <div style={card}>
                    <div style={{ color: "#6b7280", fontSize: 13 }}>
                      Avg Clean Job Hours
                    </div>
                    <div style={{ fontWeight: 900, fontSize: 24 }}>
                      {analysisSummary.avgCleanHours.toFixed(2)}
                    </div>
                  </div>
                  <div style={card}>
                    <div style={{ color: "#6b7280", fontSize: 13 }}>
                      Avg Delayed Job Hours
                    </div>
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
                    <div style={{ color: "#6b7280" }}>
                      No completed activity data yet.
                    </div>
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
                            <div style={{ color: "#6b7280", fontSize: 12 }}>
                              Total Hrs
                            </div>
                            <div style={{ fontWeight: 800 }}>
                              {row.total_hours.toFixed(2)}
                            </div>
                          </div>
                          <div>
                            <div style={{ color: "#6b7280", fontSize: 12 }}>
                              Avg Hrs/Job
                            </div>
                            <div style={{ fontWeight: 800 }}>
                              {row.avg_hours_per_job.toFixed(2)}
                            </div>
                          </div>
                          <div>
                            <div style={{ color: "#6b7280", fontSize: 12 }}>
                              Avg Min/Sqft
                            </div>
                            <div style={{ fontWeight: 800 }}>
                              {row.avg_min_per_sqft == null
                                ? "—"
                                : row.avg_min_per_sqft.toFixed(2)}
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
                    <div style={{ color: "#6b7280" }}>
                      No completed jobs found for this filter.
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 8 }}>
                      {filteredAnalysisRows.map((row) => {
                        const totalMeasure =
                          Number(row.patio_sqft || 0) +
                          Number(row.wall_sqft || 0);

                        const minPerSqft =
                          totalMeasure > 0
                            ? Number(row.total_minutes || 0) / totalMeasure
                            : 0;

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
                                Patio: {Number(row.patio_sqft || 0)} sqft •
                                Wall: {Number(row.wall_sqft || 0)} sqft • Cap:{" "}
                                {Number(row.cap_lf || 0)} lf
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
                                {minPerSqft > 0
                                  ? `${minPerSqft.toFixed(2)} min/sqft`
                                  : "—"}
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
        )}

        {view.screen === "estimator" && isManager && (
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
                    setEstimateInputs((s) => ({
                      ...s,
                      patio_sqft: e.target.value,
                    }))
                  }
                />

                <input
                  style={input}
                  placeholder="Wall Sqft"
                  inputMode="decimal"
                  value={estimateInputs.wall_sqft}
                  onChange={(e) =>
                    setEstimateInputs((s) => ({
                      ...s,
                      wall_sqft: e.target.value,
                    }))
                  }
                />

                <input
                  style={input}
                  placeholder="Cap LF"
                  inputMode="decimal"
                  value={estimateInputs.cap_lf}
                  onChange={(e) =>
                    setEstimateInputs((s) => ({
                      ...s,
                      cap_lf: e.target.value,
                    }))
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
                    onChange={(e) =>
                      setExcludeDelayedEstimate(e.target.checked)
                    }
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
                    <div style={{ color: "#6b7280", fontSize: 13 }}>
                      Low Estimate
                    </div>
                    <div style={{ fontWeight: 900, fontSize: 24 }}>
                      {estimateResult.low_hours.toFixed(2)} hrs
                    </div>
                  </div>

                  <div style={card}>
                    <div style={{ color: "#6b7280", fontSize: 13 }}>
                      Likely Estimate
                    </div>
                    <div style={{ fontWeight: 900, fontSize: 24 }}>
                      {estimateResult.likely_hours.toFixed(2)} hrs
                    </div>
                  </div>

                  <div style={card}>
                    <div style={{ color: "#6b7280", fontSize: 13 }}>
                      High Estimate
                    </div>
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
        )}

        {view.screen === "dashboard" && isManager && (
          <div style={{ display: "grid", gap: 14 }}>
            <button style={btn} onClick={goJobs}>
              ← Back to Jobs
            </button>

            <div style={card}>
              <div style={{ fontWeight: 900, marginBottom: 10 }}>
                Job Progress
              </div>

              {jobProgressRows.length === 0 ? (
                <div style={{ color: "#6b7280" }}>
                  No jobs in progress yet.
                </div>
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
                            <div
                              style={{ fontWeight: 900, color: "#111827" }}
                            >
                              {j.name}
                            </div>
                            <div style={{ color: "#6b7280", fontSize: 13 }}>
                              Patio: {Number(j.patio_sqft || 0)} sqft • Wall:{" "}
                              {Number(j.wall_sqft || 0)} sqft • Cap:{" "}
                              {Number(j.cap_lf || 0)} lf
                            </div>
                          </div>

                          <div style={{ textAlign: "right" }}>
                            <div
                              style={{ fontWeight: 900, color: "#111827" }}
                            >
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
                                <div style={{ color: "#6b7280" }}>
                                  {a.activity}
                                </div>
                                <div
                                  style={{
                                    color: "#111827",
                                    fontWeight: 700,
                                  }}
                                >
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
                            {r.display_name || "Worker"} —{" "}
                            {r.job_name || "Job"}
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
        )}

        {view.screen === "completed" && isManager && (
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
        )}

        {view.screen === "completedReport" &&
          completedJobReport &&
          isManager && (
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
                      ? new Date(
                          completedJobReport.completed_at
                        ).toLocaleString()
                      : "—"}
                  </div>
                  <div>
                    <strong>Total Labor:</strong>{" "}
                    {Number(completedJobReport.total_hours || 0).toFixed(2)} hrs
                  </div>
                  <div>
                    <strong>Install Rate:</strong>{" "}
                    {Number(completedJobReport.min_per_sqft || 0).toFixed(2)}{" "}
                    min/sqft
                  </div>
                </div>
              </div>

              <div style={card}>
                <div style={{ fontWeight: 900, marginBottom: 10 }}>
                  Activity Breakdown
                </div>

                {completedJobActivities.length === 0 ? (
                  <div style={{ color: "#6b7280" }}>
                    No activity breakdown found.
                  </div>
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
                            : `${Number(a.unit_rate).toFixed(2)} ${
                                a.unit_rate_label || ""
                              }`}
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
                  <div style={{ color: "#6b7280" }}>
                    No notes found for this job.
                  </div>
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

                        <div
                          style={{ color: "#111827", whiteSpace: "pre-wrap" }}
                        >
                          {note.note_text}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        {view.screen === "job" && currentJob && (
          <div style={{ display: "grid", gap: 14 }}>
            <button style={btn} onClick={goJobs}>
              ← Back
            </button>

            {isManager && (
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

                  setState((s) => ({
                    ...s,
                    jobs: s.jobs.filter((j) => j.id !== currentJob.id),
                  }));

                  alert("Job marked complete.");
                  goJobs();
                }}
              >
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
                  <div style={{ color: "#6b7280", fontSize: 13 }}>
                    Patio Sqft
                  </div>
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
                  <div style={{ color: "#6b7280", fontSize: 13 }}>
                    Wall Sqft
                  </div>
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
                  {state.activities.map((a) => (
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

                      <div
                        style={{ color: "#111827", whiteSpace: "pre-wrap" }}
                      >
                        {note.note_text}
                      </div>
                    </div>
                  ))}
                </div>
              )}
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