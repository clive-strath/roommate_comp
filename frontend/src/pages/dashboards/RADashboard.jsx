import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Navbar from "../../components/Navbar";

export default function RADashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="page-container">
      <Navbar />
      <div className="main-content">
        <div style={{ marginBottom: "28px" }}>
          <h1 style={{ fontSize: "28px", marginBottom: "4px" }}>Resident Advisor Dashboard</h1>
          <p style={{ color: "var(--text-muted)" }}>
            Assigned Block: <strong style={{ color: "var(--text-main)" }}>Block {user?.hostel_block || "Unassigned"}</strong>
          </p>
        </div>

        <div className="dashboard-grid">
          {/* Main Action Area */}
          <div>
            {/* Conflict Logging -> Relationship Support */}
            <div className="card">
              <h3 className="card-title">
                <span>🤝</span> Roommate Relationship Support
              </h3>
              <p style={{ color: "var(--text-muted)", fontSize: "14px", marginBottom: "20px", lineHeight: "1.5" }}>
                Use this form to initiate roommate relationship support or mediation logs for residents facing compatibility issues within your block.
              </p>
              
              <div style={{ padding: "30px", border: "2px dashed var(--border-color)", borderRadius: "var(--radius-lg)", textAlign: "center", backgroundColor: "var(--bg-primary)" }}>
                <span style={{ fontSize: "32px", display: "block", marginBottom: "12px" }}>📝</span>
                <span style={{ fontWeight: "700", display: "block", color: "var(--text-main)", marginBottom: "4px" }}>
                  Support Logs Unavailable
                </span>
                <span style={{ fontSize: "13px", color: "var(--text-muted)", display: "block", maxWidth: "320px", margin: "0 auto" }}>
                  The mediation reporting forms will be activated in the next development phase.
                </span>
              </div>
            </div>

            {/* Active Conflicts -> Current Resident Concerns */}
            <div className="card">
              <h3 className="card-title">
                <span>⚠️</span> Current Resident Concerns in Block {user?.hostel_block || "Unassigned"}
              </h3>
              <div className="empty-state" style={{ padding: "30px 0" }}>
                <span className="empty-state-icon" style={{ fontSize: "36px" }}>✓</span>
                <h4 className="empty-state-title" style={{ fontSize: "15px" }}>No resident concerns reported</h4>
                <p className="empty-state-desc" style={{ maxWidth: "340px" }}>
                  There are currently no active roommate concerns or disputes logged in your hostel block.
                </p>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div>
            <div className="card">
              <h3 className="card-title">
                <span>📘</span> RA Quick Guide
              </h3>
              <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "12px", lineHeight: "1.6" }}>
                As an RA, your focus is to cultivate a healthy, collaborative community:
              </p>
              <ul style={{ fontSize: "13px", color: "var(--text-main)", paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                <li>Listen empathetically to roommate lifestyle concerns.</li>
                <li>Recommend updating profiles if lifestyle changes occur.</li>
                <li>Escalate persistent issues through relationship support triggers.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
