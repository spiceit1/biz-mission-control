"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Settings,
  Database,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Play,
  Sprout,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Server,
  Zap,
  ShieldCheck,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TableInfo {
  table: string;
  exists: boolean;
  rows: number;
}

interface StatusResponse {
  connected: boolean;
  db_connected: boolean;
  tables: TableInfo[];
  instance: string;
  error?: string;
}

interface MigrateResponse {
  ok: boolean;
  success: boolean;
  summary?: string;
  total?: number;
  created?: number;
  already_existed?: number;
  tables?: { table: string; action: string }[];
  error?: string;
}

interface SeedResponse {
  ok: boolean;
  success: boolean;
  instance?: string;
  summary?: string;
  seeded?: number;
  skipped?: number;
  results?: { table: string; action: string; detail?: string }[];
  error?: string;
}

interface HealthCheckResult {
  name: string;
  status: "pass" | "fail";
  statusCode?: number;
  error?: string;
}

interface HealthResponse {
  ok: boolean;
  passed: number;
  failed: number;
  total: number;
  checks: HealthCheckResult[];
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SetupPage() {
  const [isMobile, setIsMobile] = useState(false);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [migrateResult, setMigrateResult] = useState<MigrateResponse | null>(null);
  const [seedResult, setSeedResult] = useState<SeedResponse | null>(null);
  const [showAllTables, setShowAllTables] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [healthChecking, setHealthChecking] = useState(false);
  const [healthResult, setHealthResult] = useState<HealthResponse | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/setup/status");
      if (res.ok) {
        const data: StatusResponse = await res.json();
        setStatus(data);
      } else {
        setStatus({ connected: false, db_connected: false, tables: [], instance: "personal", error: "Failed to fetch status" });
      }
    } catch (e) {
      setStatus({ connected: false, db_connected: false, tables: [], instance: "personal", error: String(e) });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const runMigration = async () => {
    setMigrating(true);
    setMigrateResult(null);
    try {
      const res = await fetch("/api/setup/migrate", { method: "POST" });
      const data: MigrateResponse = await res.json();
      setMigrateResult(data);
      await fetchStatus();
    } catch (e) {
      setMigrateResult({ ok: false, success: false, error: String(e) });
    }
    setMigrating(false);
  };

  const runSeed = async () => {
    setSeeding(true);
    setSeedResult(null);
    try {
      const res = await fetch("/api/setup/seed", { method: "POST" });
      const data: SeedResponse = await res.json();
      setSeedResult(data);
    } catch (e) {
      setSeedResult({ ok: false, success: false, error: String(e) });
    }
    setSeeding(false);
  };

  const runHealthCheck = async () => {
    setHealthChecking(true);
    setHealthResult(null);
    try {
      const res = await fetch("/api/setup/health");
      const data: HealthResponse = await res.json();
      setHealthResult(data);
    } catch (e) {
      setHealthResult({ ok: false, passed: 0, failed: 1, total: 1, checks: [{ name: "Health API", status: "fail", error: String(e) }] });
    }
    setHealthChecking(false);
  };

  const connected = status?.connected || status?.db_connected || false;
  const tables = status?.tables || [];
  const existingCount = tables.filter((t) => t.exists).length;
  const missingCount = tables.filter((t) => !t.exists).length;
  const allTablesOk = connected && missingCount === 0 && tables.length > 0;
  const instance = status?.instance || "personal";
  const isBiz = instance === "biz";

  return (
    <div
      style={{
        height: "100%",
        overflowY: "auto",
        overflowX: "hidden",
        background: "var(--bg-primary)",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: isMobile ? "20px 16px 16px" : "28px 40px 20px",
          borderBottom: "1px solid var(--border-subtle)",
          background: "var(--bg-elevated)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              background: "#7c5cfc22",
              border: "1px solid #7c5cfc40",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Settings size={18} color="#7c5cfc" />
          </div>
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: isMobile ? "20px" : "24px",
                fontWeight: 700,
                color: "var(--text-primary)",
              }}
            >
              Setup & Health Check
            </h1>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--text-tertiary)" }}>
              Database bootstrap, migration, and instance configuration
            </p>
          </div>
        </div>
      </div>

      <div
        style={{
          padding: isMobile ? "20px 16px 64px" : "28px 40px 64px",
          maxWidth: "900px",
        }}
      >
        {/* ── Status Cards ─────────────────────────────────────────────────── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr",
            gap: "14px",
            marginBottom: "24px",
          }}
        >
          {/* DB Connection Card */}
          <div
            style={{
              padding: "18px 20px",
              background: "var(--bg-elevated)",
              border: `1px solid ${loading ? "var(--border-subtle)" : connected ? "#26c97a40" : "#f05b5b40"}`,
              borderRadius: "10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
              <Database size={16} color={loading ? "#666" : connected ? "#26c97a" : "#f05b5b"} />
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>Database</span>
              {loading ? (
                <Loader2 size={13} color="#666" className="spin" />
              ) : connected ? (
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#26c97a", background: "#26c97a18", border: "1px solid #26c97a40", padding: "2px 8px", borderRadius: "10px" }}>Connected</span>
              ) : (
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#f05b5b", background: "#f05b5b18", border: "1px solid #f05b5b40", padding: "2px 8px", borderRadius: "10px" }}>Error</span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: "12px", color: "var(--text-tertiary)", lineHeight: "1.5" }}>
              {loading ? "Checking..." : connected ? "Neon Postgres — online" : status?.error || "Cannot reach DATABASE_URL"}
            </p>
          </div>

          {/* Tables Card */}
          <div
            style={{
              padding: "18px 20px",
              background: "var(--bg-elevated)",
              border: `1px solid ${loading ? "var(--border-subtle)" : allTablesOk ? "#26c97a40" : missingCount > 0 ? "#f0b42940" : "var(--border-subtle)"}`,
              borderRadius: "10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
              <Server size={16} color={allTablesOk ? "#26c97a" : missingCount > 0 ? "#f0b429" : "#666"} />
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>Tables</span>
              {!loading && tables.length > 0 && (
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    fontFamily: "monospace",
                    color: allTablesOk ? "#26c97a" : "#f0b429",
                    background: allTablesOk ? "#26c97a18" : "#f0b42918",
                    border: `1px solid ${allTablesOk ? "#26c97a40" : "#f0b42940"}`,
                    padding: "2px 8px",
                    borderRadius: "10px",
                  }}
                >
                  {existingCount}/{tables.length}
                </span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: "12px", color: "var(--text-tertiary)", lineHeight: "1.5" }}>
              {loading ? "Checking..." : allTablesOk ? "All tables present" : missingCount > 0 ? `${missingCount} table${missingCount !== 1 ? "s" : ""} missing` : "Run migration to create tables"}
            </p>
          </div>

          {/* Instance Card */}
          <div
            style={{
              padding: "18px 20px",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
              <Zap size={16} color="#7c5cfc" />
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>Instance</span>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: isBiz ? "#4d7cfe" : "#7c5cfc",
                  background: isBiz ? "#4d7cfe18" : "#7c5cfc18",
                  border: `1px solid ${isBiz ? "#4d7cfe40" : "#7c5cfc40"}`,
                  padding: "2px 8px",
                  borderRadius: "10px",
                }}
              >
                {instance}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: "12px", color: "var(--text-tertiary)", lineHeight: "1.5" }}>
              {isBiz ? "Business instance" : "Personal instance — all features enabled"}
            </p>
          </div>
        </div>

        {/* ── Table Checklist ───────────────────────────────────────────────── */}
        <div
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "10px",
            marginBottom: "20px",
            overflow: "hidden",
          }}
        >
          <button
            onClick={() => setShowAllTables((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              padding: "14px 20px",
              background: "transparent",
              border: "none",
              borderBottom: showAllTables ? "1px solid var(--border-subtle)" : "none",
              cursor: "pointer",
              color: "var(--text-primary)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Database size={15} color="#7c5cfc" />
              <span style={{ fontSize: "14px", fontWeight: 600 }}>Table Checklist</span>
              {!loading && (
                <span style={{ fontSize: "12px", color: "var(--text-tertiary)", fontFamily: "monospace" }}>
                  {existingCount} ✓ &nbsp;{missingCount} ✗
                </span>
              )}
            </div>
            {showAllTables ? <ChevronUp size={15} color="#666" /> : <ChevronDown size={15} color="#666" />}
          </button>

          {showAllTables && (
            <div>
              {tables.length === 0 && (
                <div style={{ padding: "16px 20px", fontSize: "13px", color: "var(--text-tertiary)" }}>
                  {loading ? "Loading..." : "No tables found — run migration first"}
                </div>
              )}
              {tables.map((t, i) => {
                const isLast = i === tables.length - 1;
                const icon = !t.exists ? (
                  <XCircle size={14} color="#f05b5b" />
                ) : t.rows === 0 ? (
                  <AlertCircle size={14} color="#f0b429" />
                ) : (
                  <CheckCircle2 size={14} color="#26c97a" />
                );

                return (
                  <div
                    key={t.table}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "8px 20px",
                      borderBottom: isLast ? "none" : "1px solid var(--border-subtle)",
                    }}
                  >
                    {icon}
                    <code
                      style={{
                        fontFamily: "monospace",
                        fontSize: "13px",
                        color: !t.exists ? "#f05b5b" : "var(--text-secondary)",
                        flex: 1,
                      }}
                    >
                      {t.table}
                    </code>
                    <span
                      style={{
                        fontSize: "11px",
                        fontFamily: "monospace",
                        color: !t.exists ? "#f05b5b" : t.rows === 0 ? "#f0b429" : "#26c97a",
                        fontWeight: 600,
                      }}
                    >
                      {!t.exists ? "missing" : t.rows === 0 ? "empty" : `${t.rows} row${t.rows !== 1 ? "s" : ""}`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Action Buttons ─────────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: "12px", marginBottom: "24px", flexWrap: "wrap" }}>
          <button
            onClick={runMigration}
            disabled={migrating || !connected}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "11px 22px",
              background: migrating ? "#5a3fcb" : "#7c5cfc",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: migrating || !connected ? "not-allowed" : "pointer",
              opacity: !connected ? 0.4 : 1,
              transition: "background 0.15s",
            }}
          >
            {migrating ? <Loader2 size={15} className="spin" /> : <Play size={15} />}
            {migrating ? "Running..." : "Run Migration"}
          </button>

          <button
            onClick={runSeed}
            disabled={seeding || !connected || missingCount > 0}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "11px 22px",
              background: seeding ? "#1d9c5e" : "#26c97a",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: seeding || !connected || missingCount > 0 ? "not-allowed" : "pointer",
              opacity: !connected || missingCount > 0 ? 0.4 : 1,
              transition: "background 0.15s",
            }}
          >
            {seeding ? <Loader2 size={15} className="spin" /> : <Sprout size={15} />}
            {seeding ? "Seeding..." : "Seed Defaults"}
          </button>

          <button
            onClick={fetchStatus}
            disabled={loading}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "11px 18px",
              background: "transparent",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 500,
              cursor: loading ? "not-allowed" : "pointer",
              transition: "border-color 0.15s",
            }}
          >
            <RefreshCw size={15} className={loading ? "spin" : ""} />
            Refresh
          </button>

          <button
            onClick={runHealthCheck}
            disabled={healthChecking || !connected}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "11px 22px",
              background: healthChecking ? "#1a7a3c" : "#22c55e",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: healthChecking || !connected ? "not-allowed" : "pointer",
              opacity: !connected ? 0.4 : 1,
              transition: "background 0.15s",
            }}
          >
            {healthChecking ? <Loader2 size={15} className="spin" /> : <ShieldCheck size={15} />}
            {healthChecking ? "Checking..." : "Verify All Routes"}
          </button>
        </div>

        {/* ── Migration Result ──────────────────────────────────────────────── */}
        {migrateResult && (
          <div
            style={{
              padding: "16px 20px",
              background: migrateResult.ok ? "#26c97a08" : "#f05b5b08",
              border: `1px solid ${migrateResult.ok ? "#26c97a40" : "#f05b5b40"}`,
              borderRadius: "10px",
              marginBottom: "14px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
              {migrateResult.ok ? <CheckCircle2 size={15} color="#26c97a" /> : <XCircle size={15} color="#f05b5b" />}
              <span style={{ fontSize: "14px", fontWeight: 600, color: migrateResult.ok ? "#26c97a" : "#f05b5b" }}>
                {migrateResult.ok ? "Migration Complete" : "Migration Failed"}
              </span>
            </div>
            <p style={{ margin: "0 0 0 23px", fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.6" }}>
              {migrateResult.ok ? migrateResult.summary : migrateResult.error}
            </p>
            {migrateResult.ok && (migrateResult.created ?? 0) > 0 && (
              <div style={{ marginTop: "10px", marginLeft: "23px" }}>
                <div style={{ fontSize: "12px", color: "var(--text-tertiary)", marginBottom: "6px", fontWeight: 600 }}>Newly created:</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {(migrateResult.tables || [])
                    .filter((t) => t.action === "created")
                    .map((t) => (
                      <code
                        key={t.table}
                        style={{
                          fontSize: "11px",
                          padding: "2px 8px",
                          background: "#26c97a18",
                          color: "#26c97a",
                          border: "1px solid #26c97a30",
                          borderRadius: "4px",
                          fontFamily: "monospace",
                        }}
                      >
                        {t.table}
                      </code>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Seed Result ────────────────────────────────────────────────────── */}
        {seedResult && (
          <div
            style={{
              padding: "16px 20px",
              background: seedResult.ok ? "#26c97a08" : "#f05b5b08",
              border: `1px solid ${seedResult.ok ? "#26c97a40" : "#f05b5b40"}`,
              borderRadius: "10px",
              marginBottom: "14px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
              {seedResult.ok ? <Sprout size={15} color="#26c97a" /> : <XCircle size={15} color="#f05b5b" />}
              <span style={{ fontSize: "14px", fontWeight: 600, color: seedResult.ok ? "#26c97a" : "#f05b5b" }}>
                {seedResult.ok ? "Seed Complete" : "Seed Failed"}
              </span>
            </div>
            <p style={{ margin: "0 0 0 23px", fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.6" }}>
              {seedResult.ok ? seedResult.summary : seedResult.error}
            </p>
            {seedResult.ok && seedResult.results && (
              <div style={{ marginTop: "10px", marginLeft: "23px" }}>
                {seedResult.results.map((r) => (
                  <div key={r.table} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "3px 0", fontSize: "12px" }}>
                    <span style={{ color: r.action === "seeded" ? "#26c97a" : "#666", width: "12px" }}>
                      {r.action === "seeded" ? "✓" : "—"}
                    </span>
                    <code style={{ fontFamily: "monospace", color: "var(--text-secondary)" }}>{r.table}</code>
                    {r.detail && <span style={{ color: "var(--text-tertiary)" }}>{r.detail}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Health Check Results ──────────────────────────────────────────── */}
        {healthResult && (
          <div
            style={{
              background: "var(--bg-elevated)",
              border: `1px solid ${healthResult.ok ? "#22c55e40" : "#f0b42940"}`,
              borderRadius: "10px",
              marginBottom: "20px",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "14px 20px",
                borderBottom: "1px solid var(--border-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <ShieldCheck size={16} color={healthResult.ok ? "#22c55e" : "#f0b429"} />
                <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
                  Route Verification
                </span>
                <span
                  style={{
                    fontSize: "12px",
                    fontFamily: "monospace",
                    fontWeight: 700,
                    color: healthResult.ok ? "#22c55e" : "#f0b429",
                    background: healthResult.ok ? "#22c55e18" : "#f0b42918",
                    border: `1px solid ${healthResult.ok ? "#22c55e40" : "#f0b42940"}`,
                    padding: "2px 8px",
                    borderRadius: "10px",
                  }}
                >
                  {healthResult.passed}/{healthResult.total} passed
                </span>
              </div>
            </div>

            {/* Check list */}
            <div>
              {healthResult.checks.map((check, i) => {
                const isLast = i === healthResult.checks.length - 1;
                return (
                  <div
                    key={check.name}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "10px",
                      padding: "9px 20px",
                      borderBottom: isLast ? "none" : "1px solid var(--border-subtle)",
                    }}
                  >
                    <span style={{ fontSize: "14px", lineHeight: "1.4", flexShrink: 0, marginTop: "1px" }}>
                      {check.status === "pass" ? "✅" : "❌"}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: "13px",
                          fontWeight: 500,
                          color: check.status === "pass" ? "var(--text-primary)" : "#f05b5b",
                        }}
                      >
                        {check.name}
                      </span>
                      {check.statusCode && (
                        <span
                          style={{
                            marginLeft: "8px",
                            fontSize: "11px",
                            fontFamily: "monospace",
                            color: "var(--text-tertiary)",
                          }}
                        >
                          {check.statusCode}
                        </span>
                      )}
                      {check.error && (
                        <div
                          style={{
                            fontSize: "12px",
                            color: "#f05b5b",
                            marginTop: "2px",
                            opacity: 0.85,
                          }}
                        >
                          {check.error}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Overall banner */}
            <div
              style={{
                padding: "14px 20px",
                borderTop: "1px solid var(--border-subtle)",
                background: healthResult.ok ? "#22c55e10" : "#f0b42910",
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              {healthResult.ok ? (
                <>
                  <span style={{ fontSize: "20px" }}>🎉</span>
                  <span style={{ fontSize: "14px", fontWeight: 700, color: "#22c55e" }}>
                    All systems operational!
                  </span>
                </>
              ) : (
                <>
                  <span style={{ fontSize: "20px" }}>⚠️</span>
                  <span style={{ fontSize: "14px", fontWeight: 600, color: "#f0b429" }}>
                    Some routes need attention — check the errors above and ensure migration and seeding completed successfully.
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Quick Start Guide ─────────────────────────────────────────────── */}
        <div
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "10px",
            overflow: "hidden",
          }}
        >
          <button
            onClick={() => setShowGuide((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              padding: "14px 20px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--text-primary)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span>📖</span>
              <span style={{ fontSize: "14px", fontWeight: 600 }}>Quick Start Guide</span>
            </div>
            {showGuide ? <ChevronUp size={15} color="#666" /> : <ChevronDown size={15} color="#666" />}
          </button>

          {showGuide && (
            <div
              style={{
                padding: "0 20px 20px",
                borderTop: "1px solid var(--border-subtle)",
                fontSize: "14px",
                color: "var(--text-secondary)",
                lineHeight: "1.75",
              }}
            >
              <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginTop: "18px", marginBottom: "8px" }}>
                1. First-Time Setup
              </h3>
              <ol style={{ paddingLeft: "18px", margin: 0 }}>
                <li>Set <code style={{ background: "#7c5cfc12", padding: "1px 5px", borderRadius: "3px", fontSize: "13px" }}>DATABASE_URL</code> in your Netlify env (Neon connection string)</li>
                <li>Set <code style={{ background: "#7c5cfc12", padding: "1px 5px", borderRadius: "3px", fontSize: "13px" }}>NEXT_PUBLIC_INSTANCE</code> to a label like <code style={{ background: "#7c5cfc12", padding: "1px 5px", borderRadius: "3px", fontSize: "13px" }}>personal</code> or <code style={{ background: "#7c5cfc12", padding: "1px 5px", borderRadius: "3px", fontSize: "13px" }}>biz</code></li>
                <li>Click <strong>Run Migration</strong> — creates all mc_ tables</li>
                <li>Click <strong>Seed Defaults</strong> — populates base config rows</li>
              </ol>

              <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginTop: "20px", marginBottom: "8px" }}>
                2. Environment Variables
              </h3>
              <div
                style={{
                  background: "#0d0d1a",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "8px",
                  padding: "14px 16px",
                  fontSize: "13px",
                  fontFamily: "monospace",
                  lineHeight: "1.9",
                  color: "#d4d4f8",
                }}
              >
                <div><span style={{ color: "#7c5cfc" }}>DATABASE_URL</span>=postgresql://user:pass@...neon.tech/neondb</div>
                <div><span style={{ color: "#7c5cfc" }}>NEXT_PUBLIC_INSTANCE</span>=personal</div>
                <div style={{ color: "#555" }}># Optional extras:</div>
                <div><span style={{ color: "#4d7cfe" }}>TELEGRAM_BOT_TOKEN</span>=123:abc...</div>
              </div>

              <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginTop: "20px", marginBottom: "8px" }}>
                3. New Instance Checklist
              </h3>
              <ol style={{ paddingLeft: "18px", margin: 0 }}>
                <li>Create new Neon project → copy connection string</li>
                <li>Deploy this repo to Netlify (new site)</li>
                <li>Set env vars on the new Netlify site</li>
                <li>Visit <code style={{ background: "#7c5cfc12", padding: "1px 5px", borderRadius: "3px", fontSize: "13px" }}>/setup</code> → Run Migration → Seed Defaults</li>
                <li>Done — all pages will work</li>
              </ol>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
