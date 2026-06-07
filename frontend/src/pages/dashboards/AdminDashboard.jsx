import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";
import Navbar from "../../components/Navbar";

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [data,    setData]    = useState({ students:[], total:0, submitted:0, not_submitted:0 });
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [filterGender, setFilterGender] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  const fetchStudents = async () => {
    try {
      const res = await api.get("/admin/students");
      setData(res.data);
    } catch (err) {
      console.error("Failed to load students");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const handleDisable = async (studentId, studentName) => {
    if (window.confirm(`Are you sure you want to deactivate student ${studentName}?`)) {
      try {
        await api.patch(`/admin/students/${studentId}/disable`);
        setActionMessage(`Student ${studentName} has been deactivated successfully.`);
        fetchStudents(); // Refresh
        setTimeout(() => setActionMessage(""), 3000);
      } catch (err) {
        console.error("Failed to deactivate student");
      }
    }
  };

  const filtered = data.students.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
                          s.student_number.toLowerCase().includes(search.toLowerCase());
    const matchesGender = filterGender ? s.gender === filterGender : true;
    const matchesYear = filterYear ? String(s.year) === filterYear : true;
    const matchesStatus = filterStatus ? s.preferences_status === filterStatus : true;
    return matchesSearch && matchesGender && matchesYear && matchesStatus;
  });

  return (
    <div className="page-container">
      <Navbar />
      <div className="main-content">
        <div style={{ marginBottom: "28px" }}>
          <h1 style={{ fontSize: "28px", marginBottom: "4px" }}>Admin Roommate Management</h1>
          <p style={{ color: "var(--text-muted)" }}>
            Review compatibility directory status, check student profile compliance, and prepare matching cycles.
          </p>
        </div>

        {actionMessage && (
          <div className="banner banner-success">
            <span className="banner-icon">✓</span>
            <div>{actionMessage}</div>
          </div>
        )}

        {/* Stats Section */}
        <div className="stats-panel">
          <div className="stat-card stat-card-indigo">
            <div className="stat-value">{data.total}</div>
            <div className="stat-label">Total Registered Students</div>
          </div>
          <div className="stat-card stat-card-teal">
            <div className="stat-value">{data.submitted}</div>
            <div className="stat-label">Profile Complete / Ready for Matching</div>
          </div>
          <div className="stat-card stat-card-rose">
            <div className="stat-value">{data.not_submitted}</div>
            <div className="stat-label">Profile Incomplete</div>
          </div>
        </div>

        {/* Table List Card */}
        <div className="card">
          <div className="table-controls">
            <h3 className="card-title" style={{ margin: 0 }}>
              <span>👥</span> Student Compatibility Directory
            </h3>
            
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", flex: 1, justifyContent: "flex-end" }}>
              <input
                type="text"
                placeholder="Search by name or student number..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="form-input search-input"
                style={{ padding: "8px 12px", fontSize: "13.5px" }}
              />
              
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="form-select"
                style={{ width: "auto", padding: "8px 12px", fontSize: "13.5px" }}
              >
                <option value="">All Statuses</option>
                <option value="submitted">Profile Complete</option>
                <option value="not_submitted">Profile Incomplete</option>
              </select>

              <select
                value={filterGender}
                onChange={e => setFilterGender(e.target.value)}
                className="form-select"
                style={{ width: "auto", padding: "8px 12px", fontSize: "13.5px" }}
              >
                <option value="">All Genders</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="prefer_not_to_say">Prefer Not to Say</option>
              </select>

              <select
                value={filterYear}
                onChange={e => setFilterYear(e.target.value)}
                className="form-select"
                style={{ width: "auto", padding: "8px 12px", fontSize: "13.5px" }}
              >
                <option value="">All Years</option>
                {[1,2,3,4,5,6].map(y => (
                  <option key={y} value={y}>Year {y}</option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <p style={{ textAlign: "center", color: "var(--text-muted)", padding: "20px" }}>
              Loading student directory...
            </p>
          ) : (
            <div className="table-responsive">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Student Number</th>
                    <th>Year</th>
                    <th>Gender</th>
                    <th>Matching Status</th>
                    <th>Date Registered</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                        No matching student profiles found.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((s) => (
                      <tr key={s.student_id}>
                        <td style={{ fontWeight: "600" }}>{s.name}</td>
                        <td>{s.student_number}</td>
                        <td>Year {s.year}</td>
                        <td style={{ textTransform: "capitalize" }}>{s.gender?.replace("_", " ")}</td>
                        <td>
                          {s.preferences_status === "submitted" ? (
                            <span className="badge badge-success">✓ Ready for Matching</span>
                          ) : (
                            <span className="badge badge-error">✗ Profile Incomplete</span>
                          )}
                        </td>
                        <td>{s.created_at ? new Date(s.created_at).toLocaleDateString() : "—"}</td>
                        <td>
                          <button
                            onClick={() => handleDisable(s.student_id, s.name)}
                            className="btn btn-danger"
                            style={{ padding: "4px 8px", fontSize: "12px", borderRadius: "4px" }}
                          >
                            Deactivate
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Placeholders Row */}
        <div className="dashboard-grid">
          <div className="card" style={{ marginBottom: 0 }}>
            <h3 className="card-title">
              <span>🏠</span> Room Assignments
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: "13.5px", lineHeight: "1.5" }}>
              Room generation triggers the roommate pairing algorithm based on lifestyle profiles. The matching cycle can be initiated once all registration criteria are met.
            </p>
            <div style={{ marginTop: "16px", padding: "12px", background: "var(--bg-primary)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", fontSize: "12.5px", color: "var(--text-muted)", fontWeight: "500" }}>
              ⏳ Waiting for preferences submission cutoff date.
            </div>
          </div>

          <div className="card" style={{ marginBottom: 0 }}>
            <h3 className="card-title">
              <span>📋</span> Conflict Logs
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: "13.5px", lineHeight: "1.5" }}>
              Review relationship support incidents and active concerns logged by Block Resident Advisors. 
            </p>
            <div style={{ marginTop: "16px", padding: "12px", background: "var(--bg-primary)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", fontSize: "12.5px", color: "var(--text-muted)", fontWeight: "500" }}>
              ✓ All roommate relationship logs are currently clear.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
