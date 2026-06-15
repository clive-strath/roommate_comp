import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";
import Navbar from "../../components/Navbar";

export default function AdminDashboard() {
  const { user, role } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState({ students: [], total: 0, submitted: 0, not_submitted: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterGender, setFilterGender] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  // Form state
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "admin", // default to admin
    hostelBlock: "",
    password: "",
    confirmPassword: "",
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");

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

  const handleModalOpen = () => {
    // Reset form
    setForm({
      name: "",
      email: "",
      role: "admin",
      hostelBlock: "",
      password: "",
      confirmPassword: "",
    });
    setFormErrors({});
    setSubmitError("");
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
  };

  const handleFieldChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: value,
    }));
    // Clear error for this field when user types
    if (formErrors[name]) {
      const newErrors = { ...formErrors };
      delete newErrors[name];
      setFormErrors(newErrors);
    }
    // Clear submit error on any change
    if (submitError) setSubmitError("");
  };

  const handleRoleChange = (e) => {
    const value = e.target.value;
    setForm(prev => ({
      ...prev,
      role: value,
      hostelBlock: value === "resident_advisor" ? "" : form.hostelBlock, // keep hostelBlock if switching from RA to admin? Actually we want to clear when switching to admin.
    }));
    // Actually, when switching to admin, we should clear hostelBlock because it's not needed.
    if (value === "admin") {
      setForm(prev => ({
        ...prev,
        hostelBlock: "",
      }));
    }
    // Clear hostelBlock error if any
    if (formErrors.hostelBlock) {
      const newErrors = { ...formErrors };
      delete newErrors.hostelBlock;
      setFormErrors(newErrors);
    }
  };

  const validateForm = () => {
    const errors = {};
    const { name, email, role, hostelBlock, password, confirmPassword } = form;

    if (!name.trim()) errors.name = "Full name is required";
    if (!email.trim()) errors.email = "Email address is required";
    else if (!/\S+@\S+\.\S+/.test(email)) errors.email = "Email address is invalid";
    if (!role) errors.role = "Role is required";
    if (role === "resident_advisor" && !hostelBlock.trim()) errors.hostelBlock = "Hostel block is required for Resident Advisors";
    if (!password) errors.password = "Password is required";
    else if (password.length < 8) errors.password = "Password must be at least 8 characters";
    if (!confirmPassword) errors.confirmPassword = "Please confirm your password";
    else if (password !== confirmPassword) errors.confirmPassword = "Passwords do not match";

    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setSubmitLoading(true);
    setSubmitError("");

    try {
      const res = await api.post("/admin/users", {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        role: form.role,
        hostelBlock: form.role === "resident_advisor" ? form.hostelBlock.trim() : null,
      });
      // Success
      setActionMessage(`${form.role.charAt(0).toUpperCase() + form.role.slice(1)} account created successfully`);
      setModalOpen(false);
      fetchStudents(); // Refresh student table as per requirement
      setTimeout(() => setActionMessage(""), 3000);
    } catch (err) {
      let message = "An error occurred";
      if (err.response) {
        if (err.response.status === 409) {
          message = "Email already registered";
        } else if (err.response.status === 400) {
          message = err.response.data.error || "Invalid input";
        } else {
          message = err.response.data.error || "Failed to create account";
        }
      }
      setSubmitError(message);
    } finally {
      setSubmitLoading(false);
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
        <div style={{ marginBottom: "28px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ fontSize: "28px", marginBottom: "4px" }}>Admin Roommate Management</h1>
            <p style={{ color: "var(--text-muted)" }}>
              Review compatibility directory status, check student profile compliance, and prepare matching cycles.
            </p>
          </div>
          {role === "admin" && (
            <button
              onClick={handleModalOpen}
              className="btn btn-primary"
              style={{ padding: "10px 20px", fontSize: "14px", borderRadius: "4px" }}
            >
              Create Staff Account
            </button>
          )}
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

      {/* Modal */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={handleModalClose}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create Staff Account</h3>
              <button className="modal-close" onClick={handleModalClose}>
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} style={{ marginTop: "20px" }}>
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleFieldChange}
                  className="form-input"
                  style={{ width: "100%", padding: "10px", marginTop: "5px", borderRadius: "4px", border: formErrors.name ? "1px solid var(--color-error)" : "1px solid var(--border-color)" }}
                />
                {formErrors.name && (
                  <span className="error-message" style={{ display: "block", marginTop: "5px", color: "var(--color-error)", fontSize: "14px" }}>
                    {formErrors.name}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleFieldChange}
                  className="form-input"
                  style={{ width: "100%", padding: "10px", marginTop: "5px", borderRadius: "4px", border: formErrors.email ? "1px solid var(--color-error)" : "1px solid var(--border-color)" }}
                />
                {formErrors.email && (
                  <span className="error-message" style={{ display: "block", marginTop: "5px", color: "var(--color-error)", fontSize: "14px" }}>
                    {formErrors.email}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label>Role</label>
                <select
                  name="role"
                  value={form.role}
                  onChange={handleRoleChange}
                  className="form-select"
                  style={{ width: "100%", padding: "10px", marginTop: "5px", borderRadius: "4px", border: formErrors.role ? "1px solid var(--color-error)" : "1px solid var(--border-color)" }}
                >
                  <option value="">Select Role</option>
                  <option value="admin">Administrator</option>
                  <option value="resident_advisor">Resident Advisor</option>
                </select>
                {formErrors.role && (
                  <span className="error-message" style={{ display: "block", marginTop: "5px", color: "var(--color-error)", fontSize: "14px" }}>
                    {formErrors.role}
                  </span>
                )}
              </div>

              {form.role === "resident_advisor" && (
                <div className="form-group">
                  <label>Hostel Block</label>
                  <input
                    type="text"
                    name="hostelBlock"
                    value={form.hostelBlock}
                    onChange={handleFieldChange}
                    className="form-input"
                    style={{ width: "100%", padding: "10px", marginTop: "5px", borderRadius: "4px", border: formErrors.hostelBlock ? "1px solid var(--color-error)" : "1px solid var(--border-color)" }}
                  />
                  {formErrors.hostelBlock && (
                    <span className="error-message" style={{ display: "block", marginTop: "5px", color: "var(--color-error)", fontSize: "14px" }}>
                      {formErrors.hostelBlock}
                    </span>
                  )}
                </div>
              )}

              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleFieldChange}
                  className="form-input"
                  style={{ width: "100%", padding: "10px", marginTop: "5px", borderRadius: "4px", border: formErrors.password ? "1px solid var(--color-error)" : "1px solid var(--border-color)" }}
                />
                {formErrors.password && (
                  <span className="error-message" style={{ display: "block", marginTop: "5px", color: "var(--color-error)", fontSize: "14px" }}>
                    {formErrors.password}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label>Confirm Password</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={form.confirmPassword}
                  onChange={handleFieldChange}
                  className="form-input"
                  style={{ width: "100%", padding: "10px", marginTop: "5px", borderRadius: "4px", border: formErrors.confirmPassword ? "1px solid var(--color-error)" : "1px solid var(--border-color)" }}
                />
                {formErrors.confirmPassword && (
                  <span className="error-message" style={{ display: "block", marginTop: "5px", color: "var(--color-error)", fontSize: "14px" }}>
                    {formErrors.confirmPassword}
                  </span>
                )}
              </div>

              {submitError && (
                <div className="alert alert-error" style={{ marginTop: "15px", padding: "10px", background: "var(--bg-error)", color: "var(--color-error)", borderRadius: "4px" }}>
                  {submitError}
                </div>
              )}

              <div className="form-group" style={{ marginTop: "20px", textAlign: "right" }}>
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="btn btn-primary"
                  style={{ padding: "10px 20px", fontSize: "14px", borderRadius: "4px", opacity: submitLoading ? 0.7 : 1 }}
                >
                  {submitLoading ? "Creating..." : "Create Account"}
                </button>
                <button
                  type="button"
                  onClick={handleModalClose}
                  className="btn btn-secondary"
                  style={{ padding: "10px 20px", fontSize: "14px", marginLeft: "10px", borderRadius: "4px" }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}