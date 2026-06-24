import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";
import Navbar from "../../components/Navbar";

export default function AdminDashboard() {
  const { role } = useAuth();

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

  // Allocation workflow state
  const [semester, setSemester] = useState(`${new Date().getFullYear()}-S1`);
  const [allocLoading, setAllocLoading] = useState(false);
  const [allocProcessing, setAllocProcessing] = useState(false);
  const [allocError, setAllocError] = useState("");
  const [allocSuccess, setAllocSuccess] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [singles, setSingles] = useState([]);
  const [studentDirectory, setStudentDirectory] = useState({});
  const [previewMeta, setPreviewMeta] = useState({
    rooms_required: 0,
    rooms_available: 0,
    sufficient_rooms: true,
    waiting_unmatched_student_ids: [],
  });

  // Breakdown modal
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [selectedBreakdown, setSelectedBreakdown] = useState(null);

  // Override modal
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideTarget, setOverrideTarget] = useState(null);
  const [overrideReplacementId, setOverrideReplacementId] = useState("");
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);

  const clearAllocationBanners = () => {
    setAllocError("");
    setAllocSuccess("");
  };

  const formatClassification = (isFlagged) => (isFlagged ? "Flagged" : "Suggested");

  const toSuggestionRow = (pair) => ({
    row_id: `${pair.student_id_1}-${pair.student_id_2}`,
    student_id_1: pair.student_id_1,
    student_id_2: pair.student_id_2,
    student_1_name: pair.student_1_name,
    student_2_name: pair.student_2_name,
    student_1_gender: pair.student_1_gender,
    student_2_gender: pair.student_2_gender,
    student_1_number: pair.student_1_number,
    student_2_number: pair.student_2_number,
    student_1_year: pair.student_1_year,
    student_2_year: pair.student_2_year,
    score: pair.score,
    breakdown: pair.breakdown,
    is_flagged: pair.is_flagged,
    joins_existing_room: !!pair.joins_existing_room,
    classification: formatClassification(pair.is_flagged),
    status: "suggested",
    room_assignment_status: "Pending approval",
  });

  const addSingleIfMissing = (nextSingles, studentId) => {
    if (!studentDirectory[studentId]) return;
    if (nextSingles.some((s) => s.student_id === studentId)) return;

    const info = studentDirectory[studentId];
    nextSingles.push({
      student_id: studentId,
      name: info.name,
      gender: info.gender,
      student_number: info.student_number,
      year: info.year,
      status: "suggested",
    });
  };

  const getOverrideCandidates = (targetRow) => {
    const candidateMap = new Map();

    suggestions.forEach((row) => {
      if (row.status !== "suggested") return;
      if (row.row_id === targetRow.row_id) return;

      [row.student_id_1, row.student_id_2].forEach((sid) => {
        if (sid !== targetRow.student_id_1) candidateMap.set(sid, studentDirectory[sid]);
      });
    });

    singles.forEach((single) => {
      if (single.status !== "suggested") return;
      if (single.student_id !== targetRow.student_id_1) {
        candidateMap.set(single.student_id, studentDirectory[single.student_id]);
      }
    });

    return Array.from(candidateMap.entries())
      .filter(([, info]) => !!info)
      .map(([studentId, info]) => ({
        student_id: studentId,
        name: info.name,
        gender: info.gender,
        student_number: info.student_number,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  const refreshPreviewMeta = (nextSuggestions, nextSingles) => {
    const requiredRooms =
      nextSuggestions.filter((row) => row.status === "suggested" && !row.joins_existing_room).length +
      nextSingles.filter((s) => s.status === "suggested").length;

    setPreviewMeta((prev) => ({
      ...prev,
      rooms_required: requiredRooms,
      sufficient_rooms: prev.rooms_available >= requiredRooms,
    }));
  };

  const handleGenerateSuggestions = async () => {
    clearAllocationBanners();
    setAllocLoading(true);

    try {
      const res = await api.get(`/admin/allocation/preview?semester=${encodeURIComponent(semester)}`);
      const preview = res.data;

      const mappedSuggestions = (preview.matched_pairs || []).map(toSuggestionRow);
      const mappedSingles = (preview.unmatched_students || []).map((student) => ({
        ...student,
        status: "suggested",
      }));

      const directory = {};
      mappedSuggestions.forEach((row) => {
        directory[row.student_id_1] = {
          name: row.student_1_name,
          gender: row.student_1_gender,
          student_number: row.student_1_number,
          year: row.student_1_year,
        };
        directory[row.student_id_2] = {
          name: row.student_2_name,
          gender: row.student_2_gender,
          student_number: row.student_2_number,
          year: row.student_2_year,
        };
      });
      mappedSingles.forEach((student) => {
        directory[student.student_id] = {
          name: student.name,
          gender: student.gender,
          student_number: student.student_number,
          year: student.year,
        };
      });

      setStudentDirectory(directory);
      setSuggestions(mappedSuggestions);
      setSingles(mappedSingles);
      setPreviewMeta({
        rooms_required: preview.rooms_required || 0,
        rooms_available: preview.rooms_available || 0,
        sufficient_rooms: !!preview.sufficient_rooms,
        waiting_unmatched_student_ids: preview.waiting_unmatched_student_ids || [],
      });
      setAllocSuccess("Allocation suggestions generated. Review and approve desired matches.");
    } catch (err) {
      setSuggestions([]);
      setSingles([]);
      setStudentDirectory({});
      setPreviewMeta((prev) => ({
        ...prev,
        rooms_required: 0,
        sufficient_rooms: prev.rooms_available >= 0,
        waiting_unmatched_student_ids: [],
      }));
      setAllocError(err.response?.data?.error || "Failed to generate allocation suggestions.");
    } finally {
      setAllocLoading(false);
    }
  };

  const handleOpenBreakdown = (row) => {
    setSelectedBreakdown(row);
    setBreakdownOpen(true);
  };

  const handleOpenOverride = (row) => {
    setOverrideTarget(row);
    setOverrideReplacementId("");
    setOverrideOpen(true);
  };

  const handleSubmitOverride = async (e) => {
    e.preventDefault();
    if (!overrideTarget || !overrideReplacementId) return;

    clearAllocationBanners();
    setOverrideSubmitting(true);

    try {
      const replacementId = Number(overrideReplacementId);
      const res = await api.post("/admin/allocation/override", {
        semester,
        student_id_1: overrideTarget.student_id_1,
        student_id_2: replacementId,
      });

      const overrideResult = res.data;

      const nextSuggestions = [...suggestions];
      const nextSingles = [...singles];

      const targetIdx = nextSuggestions.findIndex((row) => row.row_id === overrideTarget.row_id);
      if (targetIdx === -1) {
        throw new Error("Target suggestion no longer exists.");
      }

      const oldPartnerId = nextSuggestions[targetIdx].student_id_2;

      // If replacement student is currently in another pair, remove that pair and free the displaced partner.
      const replacementPairIdx = nextSuggestions.findIndex(
        (row, idx) =>
          idx !== targetIdx &&
          row.status === "suggested" &&
          (row.student_id_1 === replacementId || row.student_id_2 === replacementId)
      );
      if (replacementPairIdx !== -1) {
        const replacementPair = nextSuggestions[replacementPairIdx];
        const displacedId = replacementPair.student_id_1 === replacementId
          ? replacementPair.student_id_2
          : replacementPair.student_id_1;

        addSingleIfMissing(nextSingles, displacedId);
        nextSuggestions.splice(replacementPairIdx, 1);
      }

      // Replacement student should not remain in singles.
      const replacementSingleIdx = nextSingles.findIndex((s) => s.student_id === replacementId);
      if (replacementSingleIdx !== -1) {
        nextSingles.splice(replacementSingleIdx, 1);
      }

      // Previous partner is freed as unmatched.
      addSingleIfMissing(nextSingles, oldPartnerId);

      const updatedTargetIdx = nextSuggestions.findIndex((row) => row.row_id === overrideTarget.row_id);
      const replacementInfo = studentDirectory[replacementId];
      nextSuggestions[updatedTargetIdx] = {
        ...nextSuggestions[updatedTargetIdx],
        row_id: `${overrideResult.student_id_1}-${overrideResult.student_id_2}`,
        student_id_1: overrideResult.student_id_1,
        student_id_2: overrideResult.student_id_2,
        student_1_name: overrideResult.student_1_name,
        student_2_name: overrideResult.student_2_name,
        student_2_gender: replacementInfo?.gender || nextSuggestions[updatedTargetIdx].student_2_gender,
        student_2_number: replacementInfo?.student_number || nextSuggestions[updatedTargetIdx].student_2_number,
        score: overrideResult.score,
        breakdown: overrideResult.breakdown,
        is_flagged: overrideResult.is_flagged,
        classification: formatClassification(overrideResult.is_flagged),
        status: "suggested",
        room_assignment_status: "Pending approval",
      };

      setSuggestions(nextSuggestions);
      setSingles(nextSingles);
      refreshPreviewMeta(nextSuggestions, nextSingles);
      setOverrideOpen(false);
      setOverrideTarget(null);
      setAllocSuccess("Match override applied and compatibility score recalculated.");
    } catch (err) {
      setAllocError(err.response?.data?.error || err.message || "Failed to override match.");
    } finally {
      setOverrideSubmitting(false);
    }
  };

  const handleApproveRow = async (row) => {
    clearAllocationBanners();
    setAllocProcessing(true);

    try {
      await api.post("/admin/allocation/approve-pair", {
        semester,
        student_id_1: row.student_id_1,
        student_id_2: row.student_id_2,
        score: row.score,
        breakdown: row.breakdown,
        joins_existing_room: row.joins_existing_room,
      });

      setSuggestions((prev) => prev.map((item) => {
        if (item.row_id !== row.row_id) return item;
        return {
          ...item,
          status: "approved",
          room_assignment_status: item.joins_existing_room ? "Assigned to partially allocated room" : "Assigned",
        };
      }));
      fetchRoomAvailability();
      setAllocSuccess("Pair approved and assigned to room.");
    } catch (err) {
      setAllocError(err.response?.data?.error || "Failed to approve pair.");
    } finally {
      setAllocProcessing(false);
    }
  };

  const handleRejectRow = async (row) => {
    clearAllocationBanners();
    setAllocProcessing(true);

    try {
      await api.post("/admin/allocation/reject-pair", {
        semester,
        student_id_1: row.student_id_1,
        student_id_2: row.student_id_2,
      });

      setSuggestions((prev) => prev.map((item) => {
        if (item.row_id !== row.row_id) return item;
        return {
          ...item,
          status: "rejected",
          room_assignment_status: "Unassigned",
        };
      }));
      setAllocSuccess("Pair rejected. Students remain unassigned.");
    } catch (err) {
      setAllocError(err.response?.data?.error || "Failed to reject pair.");
    } finally {
      setAllocProcessing(false);
    }
  };

  const handleApproveAll = async () => {
    const pendingPairs = suggestions.filter((row) => row.status === "suggested");
    const pendingSingles = singles.filter((s) => s.status === "suggested").map((s) => s.student_id);

    if (pendingPairs.length === 0 && pendingSingles.length === 0) {
      setAllocError("No suggested allocations available to approve.");
      return;
    }

    clearAllocationBanners();
    setAllocProcessing(true);

    try {
      await api.post("/admin/allocation/approve-all", {
        semester,
        pairs: pendingPairs,
        singles: pendingSingles,
      });

      const nextSuggestions = suggestions.map((row) => {
        if (row.status !== "suggested") return row;
        return {
          ...row,
          status: "approved",
          room_assignment_status: row.joins_existing_room ? "Assigned to partially allocated room" : "Assigned",
        };
      });

      const nextSingles = singles.map((single) => {
        if (single.status !== "suggested") return single;
        return {
          ...single,
          status: "approved",
        };
      });

      setSuggestions(nextSuggestions);
      setSingles(nextSingles);
      refreshPreviewMeta(nextSuggestions, nextSingles);
      fetchRoomAvailability();
      setAllocSuccess("All suggested allocations approved and assigned.");
    } catch (err) {
      setAllocError(err.response?.data?.error || "Failed to approve all suggestions.");
    } finally {
      setAllocProcessing(false);
    }
  };

  const handleRejectAll = async () => {
    clearAllocationBanners();
    setAllocProcessing(true);

    try {
      await api.post("/admin/allocation/reject-all", { semester });

      const nextSuggestions = suggestions.map((row) => {
        if (row.status !== "suggested") return row;
        return {
          ...row,
          status: "rejected",
          room_assignment_status: "Unassigned",
        };
      });

      const nextSingles = singles.map((single) => {
        if (single.status !== "suggested") return single;
        return {
          ...single,
          status: "rejected",
        };
      });

      setSuggestions(nextSuggestions);
      setSingles(nextSingles);
      refreshPreviewMeta(nextSuggestions, nextSingles);
      setAllocSuccess("All suggested allocations rejected.");
    } catch (err) {
      setAllocError(err.response?.data?.error || "Failed to reject all suggestions.");
    } finally {
      setAllocProcessing(false);
    }
  };

  const breakdownLabels = {
    wake_time: "Wake Time",
    sleep_time: "Sleep Time",
    noise_tolerance: "Noise Tolerance",
    cleanliness_level: "Cleanliness",
    guest_policy: "Guest Policy",
    bathroom_schedule: "Bathroom Schedule",
  };

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

  const fetchRoomAvailability = async () => {
    try {
      const res = await api.get("/admin/allocation/rooms-summary");
      const emptyRooms = Number(res.data?.empty_rooms || 0);
      setPreviewMeta((prev) => ({
        ...prev,
        rooms_available: emptyRooms,
        sufficient_rooms: emptyRooms >= prev.rooms_required,
      }));
    } catch (err) {
      console.error("Failed to load room availability");
    }
  };

  useEffect(() => {
    fetchStudents();
    fetchRoomAvailability();
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

        {allocError && (
          <div className="banner banner-error">
            <span className="banner-icon">!</span>
            <div>{allocError}</div>
          </div>
        )}

        {allocSuccess && (
          <div className="banner banner-success">
            <span className="banner-icon">✓</span>
            <div>{allocSuccess}</div>
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

        {/* Allocation Dashboard Card */}
        <div className="card">
          <div className="table-controls" style={{ marginBottom: "16px" }}>
            <h3 className="card-title" style={{ margin: 0 }}>
              <span>🏠</span> Room Allocation Management
            </h3>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "flex-end" }}>
              <input
                type="text"
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                className="form-input"
                placeholder="Semester (e.g. 2026-S1)"
                style={{ width: "210px", padding: "8px 12px" }}
              />
              <button
                onClick={handleGenerateSuggestions}
                className="btn btn-primary"
                disabled={allocLoading || allocProcessing}
                style={{ padding: "8px 14px", borderRadius: "8px" }}
              >
                {allocLoading ? "Generating..." : "Generate Allocation Suggestions"}
              </button>
            </div>
          </div>

          <div className="stats-panel" style={{ marginBottom: "18px" }}>
            <div className="stat-card stat-card-indigo">
              <div className="stat-value">{previewMeta.rooms_required}</div>
              <div className="stat-label">Required Empty Rooms</div>
            </div>
            <div className="stat-card stat-card-teal">
              <div className="stat-value">{previewMeta.rooms_available}</div>
              <div className="stat-label">Available Empty Rooms</div>
            </div>
            <div className="stat-card stat-card-rose">
              <div className="stat-value">{previewMeta.sufficient_rooms ? "YES" : "NO"}</div>
              <div className="stat-label">Capacity Validation</div>
            </div>
          </div>

          {!previewMeta.sufficient_rooms && (
            <div className="banner banner-warning" style={{ marginBottom: "18px" }}>
              <span className="banner-icon">⚠</span>
              <div>Allocation cannot be completed. Please add additional rooms.</div>
            </div>
          )}

          {previewMeta.waiting_unmatched_student_ids.length > 0 && (
            <div className="banner banner-warning" style={{ marginBottom: "18px" }}>
              <span className="banner-icon">!</span>
              <div>
                {previewMeta.waiting_unmatched_student_ids.length} waiting student(s) remain unmatched this run and will stay prioritised in the next allocation cycle.
              </div>
            </div>
          )}

          <div className="table-controls" style={{ marginBottom: "12px" }}>
            <h3 className="card-title" style={{ margin: 0 }}>
              <span>🧩</span> Allocation Suggestions Table
            </h3>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                onClick={handleApproveAll}
                className="btn btn-primary"
                disabled={allocProcessing || allocLoading || !previewMeta.sufficient_rooms}
                style={{ padding: "8px 14px", borderRadius: "8px" }}
              >
                Approve All
              </button>
              <button
                onClick={handleRejectAll}
                className="btn btn-secondary"
                disabled={allocProcessing || allocLoading}
                style={{ padding: "8px 14px", borderRadius: "8px" }}
              >
                Reject All
              </button>
            </div>
          </div>

          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Student 1</th>
                  <th>Student 2</th>
                  <th>Compatibility Score</th>
                  <th>Classification</th>
                  <th>Room Assignment Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {suggestions.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)" }}>
                      Generate allocation suggestions to begin workflow.
                    </td>
                  </tr>
                ) : (
                  suggestions.map((row) => (
                    <tr key={row.row_id} className={row.is_flagged ? "allocation-row-flagged" : ""}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{row.student_1_name}</div>
                        <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>{row.student_1_number}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{row.student_2_name}</div>
                        <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>{row.student_2_number}</div>
                      </td>
                      <td style={{ fontWeight: 700, color: row.score < 40 ? "var(--accent-rose-text)" : "var(--text-main)" }}>
                        {row.score}%
                      </td>
                      <td>
                        {row.is_flagged ? (
                          <span className="badge badge-warning">Flagged</span>
                        ) : (
                          <span className="badge badge-success">Suggested</span>
                        )}
                      </td>
                      <td>
                        {row.status === "approved" ? (
                          <span className="badge badge-success">{row.room_assignment_status}</span>
                        ) : row.status === "rejected" ? (
                          <span className="badge badge-error">Unassigned</span>
                        ) : (
                          <span className="badge badge-warning">Pending approval</span>
                        )}
                      </td>
                      <td>
                        <div className="allocation-actions">
                          <button
                            onClick={() => handleOpenBreakdown(row)}
                            className="btn btn-secondary"
                            style={{ padding: "5px 8px", fontSize: "12px", borderRadius: "6px" }}
                          >
                            View Breakdown
                          </button>
                          <button
                            onClick={() => handleOpenOverride(row)}
                            className="btn btn-secondary"
                            style={{ padding: "5px 8px", fontSize: "12px", borderRadius: "6px" }}
                            disabled={row.status !== "suggested" || allocProcessing}
                          >
                            Override Match
                          </button>
                          <button
                            onClick={() => handleApproveRow(row)}
                            className="btn btn-primary"
                            style={{ padding: "5px 8px", fontSize: "12px", borderRadius: "6px" }}
                            disabled={row.status !== "suggested" || allocProcessing || !previewMeta.sufficient_rooms}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleRejectRow(row)}
                            className="btn btn-danger"
                            style={{ padding: "5px 8px", fontSize: "12px", borderRadius: "6px" }}
                            disabled={row.status !== "suggested" || allocProcessing}
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {singles.length > 0 && (
            <div style={{ marginTop: "20px" }}>
              <h4 style={{ marginBottom: "10px" }}>Unmatched Students (Solo Allocations)</h4>
              <div className="table-responsive">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Gender</th>
                      <th>Status</th>
                      <th>Room Assignment Outcome</th>
                    </tr>
                  </thead>
                  <tbody>
                    {singles.map((single) => (
                      <tr key={single.student_id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{single.name}</div>
                          <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>{single.student_number}</div>
                        </td>
                        <td style={{ textTransform: "capitalize" }}>{single.gender?.replace("_", " ")}</td>
                        <td>
                          {single.status === "approved" ? (
                            <span className="badge badge-success">Approved</span>
                          ) : single.status === "rejected" ? (
                            <span className="badge badge-error">Rejected</span>
                          ) : (
                            <span className="badge badge-warning">Suggested</span>
                          )}
                        </td>
                        <td>
                          {single.status === "approved"
                            ? "Room assigned as awaiting_roommate"
                            : "Pending decision"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Secondary Row */}
        <div className="dashboard-grid">
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

          <div className="card" style={{ marginBottom: 0 }}>
            <h3 className="card-title">
              <span>ℹ️</span> Allocation Workflow
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: "13.5px", lineHeight: "1.6" }}>
              1. Generate suggestions from compatibility scoring and maximum weight matching.
              <br />
              2. Review low-compatibility rows and override pairings where required.
              <br />
              3. Approve individual rows or bulk approve all suggestions.
              <br />
              4. Approved pairs are assigned to empty rooms. Singles are assigned as awaiting roommates.
            </p>
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

      {breakdownOpen && selectedBreakdown && (
        <div className="modal-backdrop" onClick={() => setBreakdownOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Compatibility Breakdown</h3>
              <button className="modal-close" onClick={() => setBreakdownOpen(false)}>×</button>
            </div>
            <div style={{ marginTop: "16px" }}>
              <p style={{ marginBottom: "12px", color: "var(--text-muted)" }}>
                {selectedBreakdown.student_1_name} ↔ {selectedBreakdown.student_2_name}
              </p>
              <div className="table-responsive">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(selectedBreakdown.breakdown || {}).map(([key, val]) => (
                      <tr key={key}>
                        <td>{breakdownLabels[key] || key}</td>
                        <td>{val}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: "10px", fontWeight: 700 }}>
                Total Score: {selectedBreakdown.score}%
              </div>
            </div>
          </div>
        </div>
      )}

      {overrideOpen && overrideTarget && (
        <div className="modal-backdrop" onClick={() => setOverrideOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Override Match</h3>
              <button className="modal-close" onClick={() => setOverrideOpen(false)}>×</button>
            </div>
            <form onSubmit={handleSubmitOverride} style={{ marginTop: "16px" }}>
              <p style={{ color: "var(--text-muted)", marginBottom: "12px" }}>
                Replace pairing for <strong>{overrideTarget.student_1_name}</strong>.
              </p>
              <div className="form-group">
                <label className="form-label">Current Match</label>
                <input
                  className="form-input"
                  value={`${overrideTarget.student_1_name} ↔ ${overrideTarget.student_2_name}`}
                  readOnly
                />
              </div>
              <div className="form-group">
                <label className="form-label">Select Replacement Student</label>
                <select
                  className="form-select"
                  value={overrideReplacementId}
                  onChange={(e) => setOverrideReplacementId(e.target.value)}
                  required
                >
                  <option value="">Choose a student...</option>
                  {getOverrideCandidates(overrideTarget).map((candidate) => (
                    <option key={candidate.student_id} value={candidate.student_id}>
                      {candidate.name} ({candidate.student_number})
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setOverrideOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={overrideSubmitting}
                >
                  {overrideSubmitting ? "Applying..." : "Apply Override"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}