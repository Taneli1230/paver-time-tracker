import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import PaversJobsScreen from "./components/PaversJobsScreen";
import LoginScreen from "./components/LoginScreen";
import PayrollScreen from "./components/PayrollScreen";
import BenchmarksScreen from "./components/BenchmarksScreen";
import EstimatorScreen from "./components/EstimatorScreen";
import CompletedJobsScreen from "./components/CompletedJobsScreen";
import CompletedJobReportScreen from "./components/CompletedJobReportScreen";
import DashboardScreen from "./components/DashboardScreen";
import JobDetailScreen from "./components/JobDetailScreen";
import LawnAccountsScreen from "./components/LawnAccountsScreen";
import LawnAccountDetailScreen from "./components/LawnAccountDetailScreen";
import LawnBillingScreen from "./components/LawnBillingScreen";

const STORAGE_KEY = "paver_time_tracker_v1";

const DIVISIONS = {
  PAVERS: "Pavers",
  LANDSCAPE: "Landscape Install",
  LAWN: "Lawn Care / Mowing",
};

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
  const diffToThursday = (day - 4 + 7) % 7;
  d.setDate(d.getDate() - diffToThursday);
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
  const [selectedDivision, setSelectedDivision] = useState(DIVISIONS.PAVERS);
  const [dashboardRows, setDashboardRows] = useState([]);
  const [jobProgressRows, setJobProgressRows] = useState([]);
  const [jobActivityRows, setJobActivityRows] = useState([]);
  const [completedJobs, setCompletedJobs] = useState([]);
  const [completedJobReport, setCompletedJobReport] = useState(null);
  const [completedJobActivities, setCompletedJobActivities] = useState([]);
  const [completedJobNotes, setCompletedJobNotes] = useState([]);
  const [lawnAccounts, setLawnAccounts] = useState([]);
  const [lawnVisits, setLawnVisits] = useState([]);
  const [currentAccount, setCurrentAccount] = useState(null);
  const [lawnTimer, setLawnTimer] = useState(null);
 const [billingMonth, setBillingMonth] = useState(() => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
});
const [billingData, setBillingData] = useState([]);

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
    const [crewId, setCrewId] = useState(null);
    const [role, setRole] = useState("laborer");
    const [payrollWeekOffset, setPayrollWeekOffset] = useState(0);
    const [editingEntry, setEditingEntry] = useState(null);
    const [editMinutes, setEditMinutes] = useState("");
    const [editActivity, setEditActivity] = useState("");

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
  if (!session || !crewId) return;

  (async () => {
    const { data: timer, error } = await supabase
      .from("lawn_active_timers")
      .select("*")
      .eq("worker_id", session.user.id)
      .maybeSingle();

    if (error) {
      console.error("lawn active timer load error", error);
      return;
    }

    if (!timer) return;

    setLawnTimer({
      accountId: timer.account_id,
      serviceType: timer.service_type,
      startedAt: new Date(timer.started_at).getTime(),
    });
  })();
}, [session, crewId]);

    useEffect(() => {
      if (!crewId) return;
      loadCrewMemberMap();
    }, [crewId]);

    useEffect(() => {
      if (crewId && selectedDivision === DIVISIONS.LAWN) {
        loadLawnAccounts();
      }
    }, [crewId, selectedDivision]);

    useEffect(() => {
      if (!crewId) return;

      (async () => {
        const { data: jobs, error: jErr } = await supabase
          .from("jobs")
          .select("*")
          .eq("crew_id", crewId)
          .eq("division", selectedDivision)
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
    }, [crewId, selectedDivision]);

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

    const lawnTimerElapsedMs = useMemo(() => {
      if (!lawnTimer) return 0;
      return tick - lawnTimer.startedAt;
    }, [lawnTimer, tick]);

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

    async function startLawnTimer(accountId, serviceType) {
  if (!session) return alert("Not logged in");
  if (!crewId) return alert("Crew not loaded yet.");

  const startedISO = new Date().toISOString();

  const { error } = await supabase.from("lawn_active_timers").upsert({
    worker_id: session.user.id,
    crew_id: crewId,
    account_id: accountId,
    service_type: serviceType,
    started_at: startedISO,
  });

  if (error) {
    console.error("lawn timer start error", error);
    alert(error.message);
    return;
  }

  setLawnTimer({
    accountId,
    serviceType,
    startedAt: new Date(startedISO).getTime(),
  });
}

async function stopLawnTimer() {
  if (!session) return;
  if (!lawnTimer) return;

  const endedAt = Date.now();
  const minutes = (endedAt - lawnTimer.startedAt) / 60000;

  const { data, error } = await supabase
    .from("visits")
    .insert([
      {
        account_id: lawnTimer.accountId,
        crew_id: crewId,
        worker_id: session.user.id,
        visit_date: localDateString(),
        service_type: lawnTimer.serviceType,
        total_minutes: minutes,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("visit insert error", error);
    alert(error.message);
    return;
  }

  const { error: delErr } = await supabase
    .from("lawn_active_timers")
    .delete()
    .eq("worker_id", session.user.id);

  if (delErr) console.error("lawn timer delete error", delErr);

  setLawnVisits((prev) => [data, ...prev]);
  setLawnTimer(null);
}
async function editLawnVisit(visit) {
  const newMinutes = window.prompt(
    `Edit minutes for ${visit.service_type} on ${visit.visit_date}`,
    String(Number(visit.total_minutes || 0).toFixed(0))
  );
  if (newMinutes === null) return;

  const mins = Number(newMinutes);
  if (Number.isNaN(mins) || mins < 0) {
    alert("Enter a valid number of minutes.");
    return;
  }

  const newService = window.prompt(
    "Edit service type (Mowing or Spray/Weed)",
    visit.service_type
  );
  if (newService === null) return;

  if (newService !== "Mowing" && newService !== "Spray/Weed") {
    alert("Service type must be Mowing or Spray/Weed.");
    return;
  }

  const newDate = window.prompt(
    "Edit visit date (YYYY-MM-DD)",
    visit.visit_date
  );
  if (newDate === null) return;

  const { error } = await supabase
    .from("visits")
    .update({
      total_minutes: mins,
      service_type: newService,
      visit_date: newDate,
    })
    .eq("id", visit.id);

  if (error) {
    console.error("edit visit error", error);
    alert(error.message);
    return;
  }

  setLawnVisits((prev) =>
    prev.map((v) =>
      v.id === visit.id
        ? { ...v, total_minutes: mins, service_type: newService, visit_date: newDate }
        : v
    )
  );
}

async function deleteLawnVisit(visit) {
  if (!confirm(`Delete ${visit.service_type} visit on ${visit.visit_date}?`)) return;

  const { error } = await supabase
    .from("visits")
    .delete()
    .eq("id", visit.id);

  if (error) {
    console.error("delete visit error", error);
    alert(error.message);
    return;
  }

  setLawnVisits((prev) => prev.filter((v) => v.id !== visit.id));
}
    async function loadBilling() {
      if (!crewId) return alert("Crew not loaded yet.");

      const [year, month] = billingMonth.split("-").map(Number);
      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

      const { data: visits, error: vErr } = await supabase
        .from("visits")
        .select("*")
        .eq("crew_id", crewId)
        .gte("visit_date", startDate)
        .lte("visit_date", endDate)
        .order("visit_date", { ascending: true });

      if (vErr) {
        console.error("billing visits load error", vErr);
        alert(vErr.message);
        return;
      }

      const { data: accounts, error: aErr } = await supabase
        .from("accounts")
        .select("*")
        .eq("crew_id", crewId);

      if (aErr) {
        console.error("billing accounts load error", aErr);
        alert(aErr.message);
        return;
      }

      const acctMap = new Map();
      for (const a of accounts ?? []) {
        acctMap.set(a.id, a);
      }

      const grouped = new Map();

      for (const v of visits ?? []) {
        const acctId = v.account_id;
        const acct = acctMap.get(acctId);
        if (!acct) continue;

        if (!grouped.has(acctId)) {
          grouped.set(acctId, {
            account_id: acctId,
            name: acct.name || "Unknown",
            address: acct.address || "",
            cut_price: Number(acct.cut_price || 0),
            spray_rate_per_min: Number(acct.spray_rate_per_min || 2),
            visits: [],
            visitIds: [],
            mowingCount: 0,
            mowingTotal: 0,
            sprayCount: 0,
            sprayTotal: 0,
            total: 0,
            allBilled: true,
          });
        }

        const g = grouped.get(acctId);
        g.visitIds.push(v.id);
        if (!v.billed) g.allBilled = false;

        if (v.service_type === "Mowing") {
          const existing = g.visits.find(
            (ev) => ev.service_type === "Mowing" && ev.visit_date === v.visit_date
          );

          if (existing) {
            existing.total_minutes =
              Number(existing.total_minutes || 0) + Number(v.total_minutes || 0);
            existing.worker_count = (existing.worker_count || 1) + 1;
            if (!v.billed) existing.billed = false;
          } else {
            g.visits.push({
              ...v,
              charge: g.cut_price,
              worker_count: 1,
            });
            g.mowingCount += 1;
            g.mowingTotal += g.cut_price;
            g.total += g.cut_price;
          }
        } else {
          const charge = Number(v.total_minutes || 0) * g.spray_rate_per_min;
          g.visits.push({ ...v, charge });
          g.sprayCount += 1;
          g.sprayTotal += charge;
          g.total += charge;
        }
      }

      setBillingData(
        Array.from(grouped.values()).sort((a, b) => a.name.localeCompare(b.name))
      );
    }

    async function markBilled(accountId, visitIds) {
      if (!visitIds || visitIds.length === 0) return;

      const { error } = await supabase
        .from("visits")
        .update({ billed: true })
        .in("id", visitIds);

      if (error) {
        console.error("mark billed error", error);
        alert(error.message);
        return;
      }

      await loadBilling();
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
    async function openPayrollShiftEditorForWeek(weekDates) {
      if (!crewId) {
        alert("Your account is not assigned to a crew yet.");
        return;
      }

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

      await openPayroll(payrollWeekOffset);
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

    async function openPayroll(weekOffsetArg) {
      if (!crewId) {
        alert("Your account is not assigned to a crew yet.");
        return;
      }

      const weekOffset =
        typeof weekOffsetArg === "number" && !Number.isNaN(weekOffsetArg)
          ? weekOffsetArg
          : payrollWeekOffset;

      setPayrollWeekOffset(weekOffset);
      setView({ screen: "payroll", jobId: null });
      setPayrollLoading(true);

      const baseWeekDate = addDays(new Date(), -weekOffset * 7);
      const weekStart = startOfWeek(baseWeekDate);
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

      const isCurrentWeek = weekOffset === 0;

      let activeWithNames = [];
      if (isCurrentWeek) {
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

        activeWithNames = (activeShiftRows ?? []).map((row) => ({
          ...row,
          display_name:
            nameMap.get(String(row.user_id)) || `Worker ${shortUserId(row.user_id)}`,
        }));
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

      setWeeklyPayrollRows(Array.from(grouped.values()));
      setPayrollLoading(false);
      await openPayrollShiftEditorForWeek(weekDates);
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
            division: selectedDivision,
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
    function startEditEntry(entry) {
      setEditingEntry(entry)
      setEditMinutes(entry.minutes || "")
      setEditActivity(entry.activity || "")
    }

    async function saveEditEntry() {
      if (!editingEntry) return

      const { error } = await supabase
        .from("entries")
        .update({
          minutes: Number(editMinutes),
          activity: editActivity
        })
        .eq("id", editingEntry.id)

      if (error) {
        alert(error.message)
        return
      }

      // refresh page data
      window.location.reload()
    }

    async function deleteEntry(entry) {
      if (!confirm("Delete this entry?")) return

      const { error } = await supabase
        .from("entries")
        .delete()
        .eq("id", entry.id)

      if (error) {
        alert(error.message)
        return
      }

      window.location.reload()
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

    async function loadLawnAccounts() {
      if (!crewId) return;

      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .eq("crew_id", crewId)
        .eq("active", true)
        .order("name", { ascending: true });

      if (error) {
        console.error("accounts load error", error);
        alert(error.message);
        return;
      }

      setLawnAccounts(data ?? []);
    }

    async function addLawnAccount(newAccount) {
      if (!crewId) return alert("Crew not loaded yet.");

      const { data, error } = await supabase
        .from("accounts")
        .insert([
          {
            crew_id: crewId,
            name: newAccount.name.trim(),
            address: newAccount.address.trim(),
            cut_price: Number(newAccount.cut_price) || 0,
            spray_rate_per_min: Number(newAccount.spray_rate_per_min) || 2,
            frequency: newAccount.frequency,
            sqft: Number(newAccount.sqft) || 0,
            notes: newAccount.notes.trim() || null,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error("account insert error", error);
        alert(error.message);
        return;
      }

      setLawnAccounts((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    }

    async function openLawnAccount(accountId) {
      const account = lawnAccounts.find((a) => a.id === accountId);
      setCurrentAccount(account);
      setView({ screen: "lawnAccount", jobId: accountId });

      const { data, error } = await supabase
        .from("visits")
        .select("*")
        .eq("account_id", accountId)
        .order("visit_date", { ascending: false });

      if (error) {
        console.error("visits load error", error);
        alert(error.message);
        return;
      }

      setLawnVisits(data ?? []);
    }

    async function addLawnVisit(accountId, visitData) {
      if (!session) return alert("Not logged in");
      if (!crewId) return alert("Crew not loaded yet.");

      const { data, error } = await supabase
        .from("visits")
        .insert([
          {
            account_id: accountId,
            crew_id: crewId,
            worker_id: session.user.id,
            visit_date: localDateString(),
            service_type: visitData.service_type,
            total_minutes: visitData.total_minutes,
            notes: visitData.notes,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error("visit insert error", error);
        alert(error.message);
        return;
      }

      setLawnVisits((prev) => [data, ...prev]);
    }

    async function updateLawnAccount(accountId, patch) {
      const { error } = await supabase
        .from("accounts")
        .update(patch)
        .eq("id", accountId);

      if (error) {
        console.error("account update error", error);
        alert(error.message);
        return;
      }

      setLawnAccounts((prev) =>
        prev.map((a) => (a.id === accountId ? { ...a, ...patch } : a))
      );
      setCurrentAccount((prev) => (prev && prev.id === accountId ? { ...prev, ...patch } : prev));
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
      const baseWeekDate = addDays(new Date(), -payrollWeekOffset * 7);
      const weekStart = startOfWeek(baseWeekDate);

      return Array.from({ length: 7 }, (_, i) =>
        localDateString(addDays(weekStart, i))
      );
    }, [payrollWeekOffset]);

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
        <LoginScreen
          card={card}
          input={input}
          btn={btn}
          btnPrimary={btnPrimary}
          fontFamily={page.fontFamily}
        />
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
                {selectedDivision} Time Tracker
              </div>
              <div style={{ color: "#6b7280", fontSize: 13 }}>
                {selectedDivision === DIVISIONS.PAVERS
                  ? "Track activities → get accurate hours per sqft"
                  : "This division is under construction."}
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
              {isManager && selectedDivision === DIVISIONS.PAVERS && (
  <button style={btn} onClick={openDashboard}>
    Dashboard
  </button>
)}
{isManager && selectedDivision === DIVISIONS.PAVERS && (
  <button style={btn} onClick={openCompletedJobs}>
    Completed Jobs
  </button>
)}
{isManager && selectedDivision === DIVISIONS.PAVERS && (
  <button style={btn} onClick={openBenchmarks}>
    Benchmarks
  </button>
)}
{isManager && selectedDivision === DIVISIONS.PAVERS && (
  <button style={btn} onClick={openEstimator}>
    Estimator
  </button>
)}
              {isManager && (
                <button style={btn} onClick={() => openPayroll()}>
                  Payroll
                </button>
              )}
              {isManager && selectedDivision === DIVISIONS.LAWN && (
                <button style={btn} onClick={() => {
                  setView({ screen: "lawnBilling", jobId: null });
                  loadBilling();
                }}>
                  Billing
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
            <div style={{ fontWeight: 900, marginBottom: 10 }}>Division</div>

            <select
              style={input}
              value={selectedDivision}
              onChange={(e) => {
                setSelectedDivision(e.target.value);
                setView({ screen: "jobs", jobId: null });
              }}
            >
              <option value={DIVISIONS.PAVERS}>Pavers</option>
              <option value={DIVISIONS.LANDSCAPE}>Landscape Install</option>
              <option value={DIVISIONS.LAWN}>Lawn Care / Mowing</option>
            </select>

            <div style={{ color: "#6b7280", fontSize: 13, marginTop: 8 }}>
              Pavers is live. Other divisions are hidden behind under-construction mode for now.
            </div>
          </div>

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

          {selectedDivision === DIVISIONS.LANDSCAPE && (
            <div style={card}>
              <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 10 }}>
                Landscape Install
              </div>
              <div style={{ color: "#6b7280", marginBottom: 10 }}>
                This division is currently under construction.
              </div>
              <div style={{ color: "#6b7280" }}>
                The Pavers side remains fully live and unchanged while we build this section.
              </div>
            </div>
          )}

          {selectedDivision === DIVISIONS.LAWN && view.screen === "jobs" && (
            <LawnAccountsScreen
              card={card}
              input={input}
              btn={btn}
              btnPrimary={btnPrimary}
              accounts={lawnAccounts}
              onAddAccount={addLawnAccount}
              onOpenAccount={openLawnAccount}
            />
          )}
          {selectedDivision === DIVISIONS.LAWN && view.screen === "lawnAccount" && currentAccount && (
            <LawnAccountDetailScreen
              card={card}
              btn={btn}
              btnPrimary={btnPrimary}
              input={input}
              account={currentAccount}
              visits={lawnVisits}
              goBack={() => {
                setView({ screen: "jobs", jobId: null });
                setCurrentAccount(null);
                setLawnVisits([]);
              }}
              onAddVisit={(visitData) => addLawnVisit(currentAccount.id, visitData)}
              onUpdateAccount={updateLawnAccount}
              onStartTimer={startLawnTimer}
              onStopTimer={stopLawnTimer}
              onEditVisit={editLawnVisit}
              onDeleteVisit={deleteLawnVisit}
              activeTimer={lawnTimer}
              runningElapsedMs={lawnTimerElapsedMs}
              isManager={isManager}
            />
          )}
          {selectedDivision === DIVISIONS.LAWN && view.screen === "lawnBilling" && isManager && (
            <LawnBillingScreen
              card={card}
              btn={btn}
              btnPrimary={btnPrimary}
              goBack={() => {
                setView({ screen: "jobs", jobId: null });
                setBillingData([]);
              }}
              billingData={billingData}
              billingMonth={billingMonth}
              setBillingMonth={setBillingMonth}
              onLoadBilling={loadBilling}
              onMarkBilled={markBilled}
            />
          )}

          {selectedDivision === DIVISIONS.PAVERS && view.screen === "jobs" && (
            <PaversJobsScreen
              card={card}
              input={input}
              btnPrimary={btnPrimary}
              state={state}
              newJob={newJob}
              setNewJob={setNewJob}
              addJob={addJob}
              openJob={openJob}
            />
          )}
          {view.screen === "payroll" && isManager && (
            <PayrollScreen
              card={card}
              btn={btn}
              input={input}
              goJobs={goJobs}
              payrollLoading={payrollLoading}
              payrollRows={payrollRows}
              weeklyPayrollRows={weeklyPayrollRows}
              payrollWeekDates={payrollWeekDates}
              payrollWeekOffset={payrollWeekOffset}
              payrollShiftRows={payrollShiftRows}
              openPayroll={openPayroll}
              editPayrollShift={editPayrollShift}
            />
          )}

          {view.screen === "analysis" && isManager && (
            <BenchmarksScreen
              card={card}
              btn={btn}
              goJobs={goJobs}
              analysisLoading={analysisLoading}
              analysisSummary={analysisSummary}
              filteredAnalysisRows={filteredAnalysisRows}
              benchmarkSummaryRows={benchmarkSummaryRows}
              excludeDelayedBenchmarks={excludeDelayedBenchmarks}
              setExcludeDelayedBenchmarks={setExcludeDelayedBenchmarks}
            />
          )}

          {view.screen === "estimator" && isManager && (
            <EstimatorScreen
              card={card}
              btn={btn}
              btnPrimary={btnPrimary}
              input={input}
              goJobs={goJobs}
              estimateInputs={estimateInputs}
              setEstimateInputs={setEstimateInputs}
              excludeDelayedEstimate={excludeDelayedEstimate}
              setExcludeDelayedEstimate={setExcludeDelayedEstimate}
              estimateLoading={estimateLoading}
              estimateResult={estimateResult}
              calculateEstimate={calculateEstimate}
            />
          )}

          {view.screen === "dashboard" && isManager && (
            <DashboardScreen
              card={card}
              btn={btn}
              goJobs={goJobs}
              dashboardRows={dashboardRows}
              jobProgressRows={jobProgressRows}
              jobActivityRows={jobActivityRows}
              tick={tick}
              supervisorStopTimer={supervisorStopTimer}
            />
          )}

          {view.screen === "completed" && isManager && (
            <CompletedJobsScreen
              card={card}
              btn={btn}
              goJobs={goJobs}
              completedJobs={completedJobs}
              openCompletedJobReport={openCompletedJobReport}
            />
          )}

          {view.screen === "completedReport" &&
            completedJobReport &&
            isManager && (
              <CompletedJobReportScreen
                card={card}
                btn={btn}
                completedJobReport={completedJobReport}
                completedJobActivities={completedJobActivities}
                completedJobNotes={completedJobNotes}
                openCompletedJobs={openCompletedJobs}
              />
            )}

          {view.screen === "job" && currentJob && (
            <JobDetailScreen
              card={card}
              btn={btn}
              btnPrimary={btnPrimary}
              input={input}
              goJobs={goJobs}
              currentJob={currentJob}
              isManager={isManager}
              activities={state.activities}
              activeTimer={activeTimer}
              runningElapsedMs={runningElapsedMs}
              startTimer={startTimer}
              stopTimer={stopTimer}
              manualEntry={manualEntry}
              setManualEntry={setManualEntry}
              addManual={addManual}
              jobNotes={jobNotes}
              notesLoading={notesLoading}
              newNoteType={newNoteType}
              setNewNoteType={setNewNoteType}
              newNoteText={newNoteText}
              setNewNoteText={setNewNoteText}
              addJobNote={addJobNote}
              addingNote={addingNote}
              updateJob={updateJob}
              completeJob={async () => {
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
              editingEntry={editingEntry}
              editMinutes={editMinutes}
              setEditMinutes={setEditMinutes}
              editActivity={editActivity}
              setEditActivity={setEditActivity}
              startEditEntry={startEditEntry}
              saveEditEntry={saveEditEntry}
              setEditingEntry={setEditingEntry}
              deleteEntry={deleteEntry}
            />
          )}
        </div>
      </div>
    );
  }