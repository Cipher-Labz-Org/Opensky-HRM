"use client";

import Link from "next/link";
import { useId, useRef, useMemo } from "react";
import { ROUTES } from "@/config/routes";
import { APP_NAME } from "@/config/constants";
import { formatBusinessDateTime } from "@/lib/date-utils";
import { formatInt } from "@/lib/workspace-charts";
import { CommandCenterPlot, RING_CIRC } from "@/components/dashboard/CommandCenterPlot";
import { useCommandCenterEffects } from "@/components/dashboard/useCommandCenterEffects";
import { BirthdaysCompanyNoticesWidget } from "@/components/employee-profile/BirthdaysCompanyNoticesWidget";

const RAMP = ["var(--ramp-1)", "var(--ramp-2)", "var(--ramp-3)", "var(--ramp-4)", "var(--ramp-5)"];

type SnapshotRow = { label: string; count: number };
type TimelineItem = { at: string; title: string; body: string };
type LeaveRequest = {
  employeeName: string;
  leaveTypeName: string;
  status: string;
};
type MyTask = {
  id: string;
  title: string;
  employeeName: string;
  employeeId: string;
};

export type CommandCenterViewProps = {
  attentionCount: number;
  activeCount: number | null;
  terminatedCount: number | null;
  activeCountLoading: boolean;
  leaveDash: {
    pendingApprovals?: number;
    approvedThisMonth?: number;
    recentRequests?: LeaveRequest[];
  } | null;
  recruitDash: {
    openRequisitions?: number;
    totalCandidates?: number;
  } | null;
  snapshotRows: { title: string; rows: SnapshotRow[] };
  activityLast7Days: { label: string; count: number }[];
  leaveStatusBars: { label: string; value: number; color: string }[];
  timelineItems: TimelineItem[];
  myTasks: MyTask[];
  completing: string | null;
  onCompleteTask: (id: string) => void;
};

export function CommandCenterView(props: CommandCenterViewProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const ringGradId = useId().replace(/:/g, "");

  const totalRecords = (props.activeCount ?? 0) + (props.terminatedCount ?? 0);
  const activePct =
    totalRecords > 0 && props.activeCount != null
      ? Math.round((props.activeCount / totalRecords) * 1000) / 10
      : 0;
  const terminatedPct =
    totalRecords > 0 && props.terminatedCount != null
      ? Math.round((props.terminatedCount / totalRecords) * 1000) / 10
      : 0;

  const pendingLeave = props.leaveDash?.recentRequests?.filter((r) =>
    r.status?.toLowerCase().includes("pending")
  ) ?? [];
  const pendingCount = props.leaveDash?.pendingApprovals ?? 0;

  const leaveTypeTally = useMemo(() => {
    const tally = new Map<string, number>();
    for (const r of props.leaveDash?.recentRequests ?? []) {
      const t = r.leaveTypeName || "Other";
      tally.set(t, (tally.get(t) ?? 0) + 1);
    }
    return Array.from(tally.entries())
      .map(([name, n]) => ({ name, n }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 5);
  }, [props.leaveDash?.recentRequests]);

  const maxLeaveType = Math.max(...leaveTypeTally.map((t) => t.n), 1);
  const maxStatus = Math.max(...props.leaveStatusBars.map((b) => b.value), 1);
  const maxRank = Math.max(...props.snapshotRows.rows.map((r) => r.count), 1);
  const totalRank = props.snapshotRows.rows.reduce((s, r) => s + r.count, 0) || 1;

  const plotDays = props.activityLast7Days.map((d, i) => ({
    ...d,
    isToday: i === props.activityLast7Days.length - 1,
  }));

  const sparkPending = Math.min(100, Math.max(2, pendingCount * 11));
  const sparkReq = props.recruitDash?.totalCandidates
    ? Math.min(100, Math.max(8, (props.recruitDash.openRequisitions ?? 0) * 20 + 10))
    : 2;

  useCommandCenterEffects(rootRef, [
    props.activeCount,
    props.leaveDash,
    props.recruitDash,
    props.snapshotRows,
    props.leaveStatusBars,
    props.timelineItems,
  ]);

  const activeDisplay =
    props.activeCountLoading && props.activeCount == null ? "…" : formatInt(props.activeCount);

  return (
    <div className="osky-cc" ref={rootRef} id="dashboard-birthdays">
      <div className="head rise" style={{ animationDelay: "0.02s" }}>
        <div>
          <span className="eyebrow">
            <i aria-hidden /> {APP_NAME} · live
          </span>
          <h1>Dashboard</h1>
        </div>
        <div className="acts">
          {props.attentionCount > 0 ? (
            <span className="flagpill">
              <b>{props.attentionCount}</b> need attention
            </span>
          ) : null}
          <Link href={ROUTES.reports} className="btn no-sm">
            <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" d="M12 4v12m0 0l4-4m-4 4l-4-4M4 20h16" />
            </svg>
            Export
          </Link>
          <Link href={ROUTES.people} className="btn btn-pri">
            <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add employee
          </Link>
        </div>
      </div>

      <div className="bento">
        <section className="glass cell s6 rise" style={{ animationDelay: "0.06s" }}>
          <div className="hero">
            <div className="ring">
              <svg viewBox="0 0 120 120" aria-hidden>
                <defs>
                  <linearGradient id={ringGradId} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="var(--sky)" />
                    <stop offset="100%" stopColor="var(--ramp-3)" />
                  </linearGradient>
                </defs>
                <circle cx="60" cy="60" r="50" fill="none" stroke="var(--well)" strokeWidth="13" />
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  fill="none"
                  stroke={`url(#${ringGradId})`}
                  strokeWidth="13"
                  strokeLinecap="round"
                  strokeDasharray={RING_CIRC}
                  strokeDashoffset={RING_CIRC}
                  data-ring={activePct}
                />
              </svg>
              <span className="mid">
                <b className="tnum">{activePct}%</b>
                <span>Active</span>
              </span>
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <span className="herolab">Active employees</span>
              <div className="heronum tnum">{activeDisplay}</div>
              <div className="herosub">
                <span className="tagx t-ok">Non-terminated headcount</span>
                {totalRecords > 0 ? (
                  <span className="tagx t-idle">{formatInt(totalRecords)} records total</span>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section
          className="glass cell s3 rise"
          style={{ animationDelay: "0.1s", ["--c1" as string]: "var(--cyan)", ["--c2" as string]: "var(--sky)" }}
        >
          <div className="m-top">
            <span className="m-ic">
              <svg fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                <path strokeLinecap="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5a2.25 2.25 0 00-2.25-2.25H3.375a2.25 2.25 0 00-2.25 2.25v1.5c0 .621.504 1.125 1.125 1.125z" />
              </svg>
            </span>
            <span className="m-lab">
              Open
              <br />
              requisitions
            </span>
          </div>
          <div className="m-val tnum">{formatInt(props.recruitDash?.openRequisitions)}</div>
          <div className="m-foot">
            <span>
              {props.recruitDash?.totalCandidates
                ? `${formatInt(props.recruitDash.totalCandidates)} candidates in pipeline`
                : "No candidates in pipeline"}
            </span>
            {!props.recruitDash?.totalCandidates ? <span className="tagx t-idle">Idle</span> : null}
          </div>
          <div className="spark">
            <i data-w={sparkReq} />
          </div>
        </section>

        <section className="glass cell s3 rise" style={{ animationDelay: "0.14s", ["--c1" as string]: "var(--ramp-3)" }}>
          <div className="m-top">
            <span className="m-ic">
              <svg fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                <path strokeLinecap="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </span>
            <span className="m-lab">
              Quick
              <br />
              actions
            </span>
          </div>
          <div className="qmini">
            <Link href={ROUTES.people} className="qm" style={{ ["--q" as string]: "var(--ramp-3)" }}>
              <span className="qi">
                <svg fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                  <path strokeLinecap="round" d="M15 19.128a9.38 9.38 0 002.625.372M15 19.128V19.125m0 3.75a9.337 9.337 0 01-4.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128V9.875a3.375 3.375 0 10-6.75 0v9.253m12-6.622l-2.496-2.695a2.548 2.548 0 010-3.286l1.755-2.126a1.125 1.125 0 011.598-.043L16.5 6.11" />
                </svg>
              </span>
              <b>People Hub</b>
            </Link>
            <Link href={ROUTES.orgStructure} className="qm" style={{ ["--q" as string]: "var(--sky)" }}>
              <span className="qi">
                <svg fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                  <path strokeLinecap="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18" />
                </svg>
              </span>
              <b>Org structure</b>
            </Link>
            <Link href={ROUTES.approvals} className="qm" style={{ ["--q" as string]: "var(--amber)" }}>
              <span className="qi">
                <svg fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                  <path strokeLinecap="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
              <b>Approvals</b>
              {pendingCount > 0 ? <em>{pendingCount}</em> : null}
            </Link>
            <Link href={ROUTES.leave} className="qm" style={{ ["--q" as string]: "var(--lime)" }}>
              <span className="qi">
                <svg fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                  <path strokeLinecap="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5h13.5v11.25" />
                </svg>
              </span>
              <b>Leave</b>
            </Link>
          </div>
        </section>

        <section className="glass cell s8 rise" style={{ animationDelay: "0.18s" }}>
          <div className="ch">
            <div>
              <h3>Activity volume</h3>
              <p>Leave and recruitment events · last 7 days</p>
            </div>
            <div className="rt">
              <span className="chip">API sample</span>
              <button type="button" className="osky-ib" style={{ width: 30, height: 30 }} aria-label="Chart options">
                <svg style={{ width: 15, height: 15 }} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <circle cx="5" cy="12" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="19" cy="12" r="2" />
                </svg>
              </button>
            </div>
          </div>
          <CommandCenterPlot days={plotDays} />
        </section>

        <section
          className="glass cell s4 rise"
          style={{ animationDelay: "0.22s", ["--c1" as string]: "#E8A33C", ["--c2" as string]: "#B45309" }}
        >
          <div className="m-top">
            <span className="m-ic">
              <svg fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                <path strokeLinecap="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            <span className="m-lab">
              Pending leave
              <br />
              approvals
            </span>
          </div>
          <div className="m-val tnum">
            {formatInt(pendingCount)}
            <sub>awaiting you</sub>
          </div>
          <div className="m-foot">
            <span>{formatInt(props.leaveDash?.approvedThisMonth)} approved this month</span>
            {pendingCount > 0 ? <span className="tagx t-warn">Act today</span> : null}
          </div>
          <div className="spark">
            <i data-w={sparkPending} />
          </div>
          {pendingLeave.length > 0 ? (
            <div className="mini">
              {pendingLeave.slice(0, 2).map((r) => (
                <div key={`${r.employeeName}-${r.leaveTypeName}`} className="mi">
                  <span className="d" aria-hidden />
                  <b>{r.employeeName}</b>
                  <span>{r.leaveTypeName}</span>
                </div>
              ))}
              {pendingLeave.length > 2 ? (
                <div className="more">+{pendingLeave.length - 2} more pending outside the latest sample</div>
              ) : null}
            </div>
          ) : null}
          <div className="actrow">
            <Link href={ROUTES.approvals} className="btn btn-pri" style={{ padding: "9px 14px", fontSize: "12.5px" }}>
              Review queue
            </Link>
            <Link href={ROUTES.leave} className="btn" style={{ padding: "9px 14px", fontSize: "12.5px" }}>
              Leave workspace
            </Link>
          </div>
        </section>

        <section className="glass cell s5 rise" style={{ animationDelay: "0.26s" }}>
          <div className="ch">
            <div>
              <h3>Workforce distribution</h3>
              <p>
                {totalRank > 0 ? `${formatInt(totalRank)} employee records` : props.snapshotRows.title}
              </p>
            </div>
            <div className="rt">
              <span className="chip">{props.snapshotRows.rows.length} groups</span>
            </div>
          </div>
          {props.snapshotRows.rows.length === 0 ? (
            <p style={{ color: "var(--ink-3)", fontSize: 13, textAlign: "center", padding: "24px 0" }}>
              No headcount by unit or department yet.
            </p>
          ) : (
            <div className="ranks">
              {props.snapshotRows.rows.slice(0, 5).map((r, i) => {
                const pct = Math.round((r.count / totalRank) * 1000) / 10;
                return (
                  <div key={r.label} className="rank">
                    <span className="no">{i + 1}</span>
                    <span className="nm">{r.label}</span>
                    <span className="vv tnum">
                      {r.count}
                      <small>{pct.toFixed(1)}%</small>
                    </span>
                    <span className="tr">
                      <i style={{ background: RAMP[Math.min(i, 4)] }} data-w={Math.max((r.count / maxRank) * 100, 2.5)} />
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="glass cell s3 rise" style={{ animationDelay: "0.3s" }}>
          <div className="ch">
            <div>
              <h3>Headcount mix</h3>
              <p>Active vs terminated</p>
            </div>
          </div>
          <div className="donut">
            <div className="ring">
              <svg viewBox="0 0 120 120" aria-hidden>
                <defs>
                  <linearGradient id={`${ringGradId}-mix`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="var(--sky)" />
                    <stop offset="100%" stopColor="var(--ramp-3)" />
                  </linearGradient>
                </defs>
                <circle cx="60" cy="60" r="50" fill="none" stroke="var(--well)" strokeWidth="15" />
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  fill="none"
                  stroke="#8CA3C2"
                  strokeWidth="15"
                  strokeDasharray={RING_CIRC}
                  strokeDashoffset={RING_CIRC}
                  data-ring={100}
                />
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  fill="none"
                  stroke={`url(#${ringGradId}-mix)`}
                  strokeLinecap="round"
                  strokeWidth="15"
                  strokeDasharray={RING_CIRC}
                  strokeDashoffset={RING_CIRC}
                  data-ring={activePct}
                />
              </svg>
              <span className="mid">
                <b className="tnum">{formatInt(totalRecords)}</b>
                <span>Records</span>
              </span>
            </div>
          </div>
          <div className="keys">
            <div className="key">
              <span className="sw2" style={{ background: "var(--sky)" }} />
              Active
              <span className="pc">{activePct.toFixed(1)}%</span>
              <span className="vv">{formatInt(props.activeCount)}</span>
            </div>
            <div className="key">
              <span className="sw2" style={{ background: "#8CA3C2" }} />
              Terminated
              <span className="pc">{terminatedPct.toFixed(1)}%</span>
              <span className="vv">{formatInt(props.terminatedCount)}</span>
            </div>
          </div>
        </section>

        <section className="glass cell s4 rise" style={{ animationDelay: "0.34s" }}>
          <div className="ch">
            <div>
              <h3>Recent leave by status</h3>
              <p>Latest 5 records</p>
            </div>
          </div>
          {props.leaveStatusBars.length === 0 ? (
            <p style={{ color: "var(--ink-3)", fontSize: 13, textAlign: "center", padding: "20px 0" }}>
              No recent leave requests in the dashboard payload.
            </p>
          ) : (
            <>
              <div className="sbars">
                {props.leaveStatusBars.map((bar) => {
                  const ok = bar.label.toLowerCase().includes("approved");
                  return (
                    <div key={bar.label} className="sbar">
                      <div className="top">
                        <span className={`pill ${ok ? "p-ok" : "p-pend"}`}>
                          {bar.label}
                        </span>
                        <span className="vv tnum">{bar.value}</span>
                      </div>
                      <div className="tr">
                        <i style={{ background: bar.color }} data-w={(bar.value / maxStatus) * 100} />
                      </div>
                    </div>
                  );
                })}
              </div>
              {leaveTypeTally.length > 0 ? (
                <div className="types">
                  <div className="th">By leave type</div>
                  {leaveTypeTally.map((t) => (
                    <div key={t.name} className="ty">
                      {t.name}
                      <span className="tbar">
                        <i data-w={(t.n / maxLeaveType) * 100} />
                      </span>
                      <span className="n">{t.n}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </section>

        <section className="glass cell s8 rise" style={{ animationDelay: "0.38s" }}>
          <div className="ch">
            <div>
              <h3>Recent activity</h3>
              <p>Leave and recruitment updates</p>
            </div>
            <div className="rt">
              <span className="chip">{props.timelineItems.length} items</span>
              <Link href={ROUTES.approvals} className="btn" style={{ padding: "8px 13px", fontSize: 12 }}>
                View all
                <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            </div>
          </div>
          {props.timelineItems.length === 0 ? (
            <p style={{ color: "var(--ink-3)", fontSize: 13, textAlign: "center", padding: "28px 0" }}>
              No recent leave requests or recruitment activities returned yet.
            </p>
          ) : (
            <div className="feed">
              {props.timelineItems.map((ev, i) => {
                const approved = ev.body.toLowerCase().includes("approved") || ev.title.toLowerCase().includes("approved");
                return (
                  <div key={`${ev.at}-${i}`} className="fi">
                    <span className="fic">
                      <svg fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                        <path strokeLinecap="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5h13.5v11.25" />
                      </svg>
                    </span>
                    <span className="tx2">
                      <span className="who2">{ev.title}</span>
                      <span className="what">{ev.body}</span>
                    </span>
                    <time>{formatBusinessDateTime(ev.at)}</time>
                    <span className={`pill ${approved ? "p-ok" : "p-pend"}`}>{approved ? "Approved" : "Update"}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="glass cell s4 rise" style={{ animationDelay: "0.42s" }}>
          <div className="ch">
            <div>
              <h3>Birthdays &amp; notices</h3>
              <p>Celebrate. Connect. Stay informed.</p>
            </div>
            <div className="rt">
              <button type="button" className="osky-ib" style={{ width: 30, height: 30 }} aria-label="Birthdays options">
                <svg style={{ width: 15, height: 15 }} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <circle cx="5" cy="12" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="19" cy="12" r="2" />
                </svg>
              </button>
            </div>
          </div>
          <BirthdaysCompanyNoticesWidget embedInCommandCenter />
        </section>

        {props.myTasks.length > 0 ? (
          <section className="glass cell s12 rise" style={{ animationDelay: "0.46s" }}>
            <div className="ch">
              <div>
                <h3>My pending tasks</h3>
                <p>{props.myTasks.length} assigned to you</p>
              </div>
            </div>
            <div className="mini">
              {props.myTasks.map((task) => (
                <div key={task.id} className="mi">
                  <span className="d" style={{ background: "var(--lime)" }} aria-hidden />
                  <b>{task.title}</b>
                  <Link href={`/app/people/${task.employeeId}`} style={{ fontSize: 11, color: "var(--sky)" }}>
                    {task.employeeName}
                  </Link>
                  <button
                    type="button"
                    disabled={props.completing === task.id}
                    onClick={() => props.onCompleteTask(task.id)}
                    className="btn"
                    style={{ padding: "4px 10px", fontSize: 11, marginLeft: "auto" }}
                  >
                    {props.completing === task.id ? "…" : "Done"}
                  </button>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
