"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calendar,
  FolderOpen,
  FileText,
  Files,
  Zap,
  Brain,
  Users,
  Ticket,
  Cpu,
  ClipboardList,
  Activity,
  MessageSquare,
  Inbox,
  Menu,
  X,
  Settings,
} from "lucide-react";
import { SidebarChat } from "@/components/SidebarChat";
import { BizChat } from "@/components/BizChat";

const nav = [
  { href: "/factory", icon: Cpu, label: "Agent Factory" },
  { href: "/inbox", icon: Inbox, label: "Agent Inbox" },
  // Chat removed — Douglas uses Telegram + Discord instead
  // { href: "/chat", icon: MessageSquare, label: "Chat" },
  { href: "/heartbeat", icon: Activity, label: "Heartbeat" },
  { href: "/requests", icon: ClipboardList, label: "Requests" },
  { href: "/cron", icon: Calendar, label: "Cron Jobs" },
  { href: "/projects", icon: FolderOpen, label: "Projects" },
  { href: "/notes", icon: FileText, label: "Notes" },
  { href: "/memory", icon: Brain, label: "Memory Log" },
  { href: "/rd-team", icon: Users, label: "R&D Team" },
  // Personal features (not in base template):
  // Flip Tracker: { href: "/flips", icon: Ticket, label: "Flip Tracker" }
  { href: "/docs", icon: Files, label: "Documents" },
  { href: "/team", icon: Users, label: "Team" },
];

// Setup nav item — shown separately at the bottom, styled differently
const setupNavItem = { href: "/setup", icon: Settings, label: "Setup" };

function SidebarContents({
  pathname,
  onNavClick,
  showChat = true,
  hideChatOnChatPage = false,
}: {
  pathname: string;
  onNavClick?: () => void;
  showChat?: boolean;
  hideChatOnChatPage?: boolean;
}) {
  // Hide sidebar chat when user is on the /chat page to avoid duplicate
  const isOnChatPage = pathname === "/chat" || pathname.startsWith("/chat/");
  const shouldShowChat = showChat && !isOnChatPage;
  return (
    <>
      {/* Logo / Brand */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "14px",
          padding: "22px 28px",
          borderBottom: "1px solid var(--border-subtle)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "40px",
            height: "40px",
            borderRadius: "10px",
            background: "var(--accent-purple)",
          }}
        >
          <Zap size={20} color="white" />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: "16px", color: "var(--text-primary)" }}>
            Mission Control
          </div>
          <div style={{ color: "var(--text-tertiary)", fontSize: "13px" }}>
            {process.env.NEXT_PUBLIC_INSTANCE === "biz" ? "Business 💼" : "Douglas & Shmack 🤙"}
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav
        style={{
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          flexShrink: 0,
        }}
      >
        {nav.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavClick}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                padding: "12px 20px",
                borderRadius: "10px",
                fontSize: "16px",
                fontWeight: 500,
                textDecoration: "none",
                color: active ? "var(--text-primary)" : "var(--text-secondary)",
                background: active ? "var(--bg-hover)" : "transparent",
                transition: "background 0.15s, color 0.15s",
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.background = "var(--bg-hover)";
                  e.currentTarget.style.color = "var(--text-primary)";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--text-secondary)";
                }
              }}
            >
              <Icon
                size={22}
                style={{
                  color: active ? "var(--accent-purple)" : "var(--text-tertiary)",
                  flexShrink: 0,
                }}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Setup link — pinned at bottom, muted style */}
      <div
        style={{
          padding: "8px 16px 12px",
          marginTop: "auto",
          borderTop: "1px solid var(--border-subtle)",
          flexShrink: 0,
        }}
      >
        {(() => {
          const { href, icon: Icon, label } = setupNavItem;
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              href={href}
              onClick={onNavClick}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "8px 14px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 500,
                textDecoration: "none",
                color: active ? "var(--text-secondary)" : "var(--text-tertiary)",
                background: active ? "var(--bg-hover)" : "transparent",
                transition: "background 0.15s, color 0.15s",
                opacity: active ? 1 : 0.65,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--bg-hover)";
                e.currentTarget.style.color = "var(--text-secondary)";
                e.currentTarget.style.opacity = "1";
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--text-tertiary)";
                  e.currentTarget.style.opacity = "0.65";
                }
              }}
            >
              <Icon
                size={16}
                style={{
                  color: active ? "var(--accent-purple)" : "var(--text-tertiary)",
                  flexShrink: 0,
                }}
              />
              {label}
            </Link>
          );
        })()}
      </div>

      {/* Chat panel removed — Douglas uses Telegram + Discord */}
    </>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Listen for custom event to open menu from child pages (e.g., /chat)
  useEffect(() => {
    const handler = () => setMenuOpen(true);
    window.addEventListener("open-mobile-menu", handler);
    return () => window.removeEventListener("open-mobile-menu", handler);
  }, []);

  // Prevent body scroll when overlay is open
  useEffect(() => {
    if (menuOpen || mobileChatOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen, mobileChatOpen]);

  return (
    <>
      <style>{`
        @keyframes slideInLeft {
          from { transform: translateX(-100%); }
          to   { transform: translateX(0); }
        }
        @keyframes slideInUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        @keyframes fadeInBackdrop {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        /* Desktop: sidebar always visible, no hamburger */
        @media (min-width: 768px) {
          .mobile-topbar  { display: none !important; }
          .desktop-sidebar { display: flex !important; }
          .mobile-overlay  { display: none !important; }
          .mobile-fab      { display: none !important; }
        }

        /* Mobile: no inline sidebar, show topbar */
        @media (max-width: 767px) {
          .desktop-sidebar { display: none !important; }
          .mobile-topbar   { display: flex !important; }
          .mobile-topbar.hide-on-chat { display: none !important; }
          .layout-root {
            height: 100dvh !important;
          }

        }
      `}</style>

      <div
        className="layout-root"
        style={{
          display: "flex",
          height: "100vh",
          overflow: "hidden",
          background: "var(--bg-primary)",
        }}
      >
        {/* ── Desktop sidebar ─────────────────────────────────────── */}
        <aside
          className="desktop-sidebar"
          style={{
            display: "flex",
            flexDirection: "column",
            width: "280px",
            flexShrink: 0,
            background: "var(--bg-secondary)",
            borderRight: "1px solid var(--border-subtle)",
            overflow: "hidden",
          }}
        >
          <SidebarContents pathname={pathname} showChat={true} />
        </aside>

        {/* ── Main area ────────────────────────────────────────────── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>

          {/* Mobile top bar — hidden on /chat page since chat has its own header with agent selector */}
          <div
            className={`mobile-topbar ${pathname === "/chat" || pathname.startsWith("/chat/") ? "hide-on-chat" : ""}`}
            style={{
              display: "none",
              alignItems: "center",
              gap: "12px",
              padding: "12px 16px",
              background: "var(--bg-secondary)",
              borderBottom: "1px solid var(--border-subtle)",
              flexShrink: 0,
              zIndex: 10,
            }}
          >
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                background: "transparent",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-primary)",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <Menu size={18} />
            </button>

            {/* Current page label */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "28px",
                  height: "28px",
                  borderRadius: "7px",
                  background: "var(--accent-purple)",
                  flexShrink: 0,
                }}
              >
                <Zap size={14} color="white" />
              </div>
              <span style={{ fontWeight: 600, fontSize: "15px", color: "var(--text-primary)" }}>
                {process.env.NEXT_PUBLIC_INSTANCE === "biz" ? "Mission Control — Biz" : "Mission Control"}
              </span>
            </div>
          </div>

          {/* Page content */}
          <main style={{ flex: 1, overflow: "hidden" }}>
            {children}
          </main>
        </div>

        {/* ── Mobile overlay sidebar ───────────────────────────────── */}
        {menuOpen && (
          <div
            className="mobile-overlay"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 100,
              display: "flex",
            }}
          >
            {/* Backdrop */}
            <div
              onClick={() => setMenuOpen(false)}
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(0,0,0,0.6)",
                animation: "fadeInBackdrop 0.2s ease",
              }}
            />

            {/* Drawer */}
            <aside
              style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                width: "280px",
                maxWidth: "85vw",
                height: "100%",
                background: "var(--bg-secondary)",
                borderRight: "1px solid var(--border-subtle)",
                animation: "slideInLeft 0.22s ease",
                overflowY: "auto",
              }}
            >
              {/* Close button */}
              <button
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
                style={{
                  position: "absolute",
                  top: "16px",
                  right: "16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  background: "var(--bg-hover)",
                  border: "none",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  zIndex: 1,
                }}
              >
                <X size={16} />
              </button>

              <SidebarContents
                pathname={pathname}
                onNavClick={() => setMenuOpen(false)}
                showChat={false}
              />
            </aside>
          </div>
        )}

        {/* Chat button + overlay removed — Douglas uses Telegram + Discord */}
      </div>
    </>
  );
}
