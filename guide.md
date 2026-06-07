at > /home/claude/auth_guide.md << 'MDEOF'
# Authentication & Core Module Build Guide
## Hostel Roommate Compatibility Matching System
### For: Antigravity Agent | Stack: Flask + React + PostgreSQL (Supabase)

---

## ⚠️ BEFORE YOU START — READ THIS

- **Never commit `.env` files to Git.** Add `.env` to `.gitignore` immediately.
- **Never hardcode credentials** in source code files.
- All secrets live in `.env` only.
- The Supabase project reference is: `tgfmexsjsbbmiwmzkxfp`
- The database schema is **already applied** in Supabase. Do not recreate tables.

---

## 1. Project Structure

Build this exact folder structure before writing any code:

```
roommate-system/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── config.py
│   │   ├── models.py
│   │   ├── extensions.py
│   │   └── routes/
│   │       ├── __init__.py
│   │       ├── auth.py
│   │       ├── students.py
│   │       ├── preferences.py
│   │       ├── assignments.py
│   │       └── admin.py
│   ├── .env
│   ├── .gitignore
│   ├── requirements.txt
│   └── run.py
│
└── frontend/
    ├── src/
    │   ├── api/
    │   │   └── axios.js
    │   ├── components/
    │   │   ├── ProtectedRoute.jsx
    │   │   └── Navbar.jsx
    │   ├── pages/
    │   │   ├── auth/
    │   │   │   ├── StudentRegister.jsx
    │   │   │   └── Login.jsx
    │   │   ├── dashboards/
    │   │   │   ├── StudentDashboard.jsx
    │   │   │   ├── AdminDashboard.jsx
    │   │   │   └── RADashboard.jsx
    │   │   └── preferences/
    │   │       └── PreferenceForm.jsx
    │   ├── context/
    │   │   └── AuthContext.jsx
    │   ├── App.jsx
    │   └── main.jsx
    ├── .env
    ├── .gitignore
    └── package.json
```

---

## 2. Requirements & Installation

### 2.1 Backend — Python Packages

**`backend/requirements.txt`**
```
flask==3.0.3
flask-sqlalchemy==3.1.1
flask-jwt-extended==4.6.0
flask-bcrypt==1.0.1
flask-cors==4.0.0
psycopg2-binary==2.9.9
python-dotenv==1.0.1
email-validator==2.1.1
```

Install:
```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2.2 Frontend — Node Packages

```bash
cd frontend
npm create vite@latest . -- --template react
npm install
npm install axios react-router-dom react-hook-form
```

---

## 3. Environment Variables

### 3.1 Backend `.env`

Create `backend/.env`:

```env
# Flask
FLASK_ENV=development
FLASK_DEBUG=True
SECRET_KEY=replace-with-a-long-random-string-minimum-32-chars

# Supabase PostgreSQL connection
DATABASE_URL=postgresql://postgres:[DB_PASSWORD]@db.tgfmexsjsbbmiwmzkxfp.supabase.co:5432/postgres
DB_PASSWORD=RachSis.123

# JWT
JWT_SECRET_KEY=replace-with-another-long-random-string
JWT_ACCESS_TOKEN_EXPIRES_HOURS=24

# CORS
FRONTEND_URL=http://localhost:5173
```

>

### 3.2 Frontend `.env`

Create `frontend/.env`:
```env
VITE_API_BASE_URL=http://localhost:5000/api
```

### 3.3 `.gitignore` (both backend and frontend)

```
# Backend
.env
venv/
__pycache__/
*.pyc

# Frontend
.env
node_modules/
dist/
```

---

## 4. Backend Setup

### 4.1 Extensions — `backend/app/extensions.py`

```python
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_bcrypt import Bcrypt
from flask_cors import CORS

db     = SQLAlchemy()
jwt    = JWTManager()
bcrypt = Bcrypt()
cors   = CORS()
```

### 4.2 Config — `backend/app/config.py`

```python
import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY                    = os.getenv("SECRET_KEY", "dev-secret")
    SQLALCHEMY_DATABASE_URI       = os.getenv("DATABASE_URL")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS     = {
        "pool_pre_ping": True,
        "pool_recycle":  300,
    }
    JWT_SECRET_KEY                = os.getenv("JWT_SECRET_KEY", "dev-jwt-secret")
    JWT_ACCESS_TOKEN_EXPIRES      = timedelta(
        hours=int(os.getenv("JWT_ACCESS_TOKEN_EXPIRES_HOURS", 24))
    )
    CORS_ORIGINS                  = os.getenv("FRONTEND_URL", "http://localhost:5173")
```

### 4.3 Models — `backend/app/models.py`

> **Note:** The tables are already created in Supabase. These models map to existing tables — do NOT call `db.create_all()`.

```python
from .extensions import db
from datetime import datetime, timezone

def now_utc():
    return datetime.now(timezone.utc)

class Student(db.Model):
    __tablename__ = "students"

    student_id     = db.Column(db.Integer, primary_key=True)
    name           = db.Column(db.String(100), nullable=False)
    email          = db.Column(db.String(100), nullable=False, unique=True)
    password       = db.Column(db.String(255), nullable=False)
    student_number = db.Column(db.String(20), nullable=False, unique=True)
    year           = db.Column(db.Integer, nullable=False)
    phone          = db.Column(db.String(20))
    gender         = db.Column(db.String(20))
    status         = db.Column(db.String(10), default="active")
    created_at     = db.Column(db.DateTime(timezone=True), default=now_utc)
    updated_at     = db.Column(db.DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    # Relationships
    preferences    = db.relationship("StudentPreference", backref="student",
                                     uselist=False, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "student_id":     self.student_id,
            "name":           self.name,
            "email":          self.email,
            "student_number": self.student_number,
            "year":           self.year,
            "phone":          self.phone,
            "gender":         self.gender,
            "status":         self.status,
            "has_preferences": self.preferences is not None,
            "created_at":     self.created_at.isoformat() if self.created_at else None,
        }


class AdminUser(db.Model):
    __tablename__ = "admin_users"

    admin_id     = db.Column(db.Integer, primary_key=True)
    name         = db.Column(db.String(100), nullable=False)
    email        = db.Column(db.String(100), nullable=False, unique=True)
    password     = db.Column(db.String(255), nullable=False)
    role         = db.Column(db.String(20), nullable=False)  # admin | resident_advisor
    hostel_block = db.Column(db.String(20))
    status       = db.Column(db.String(10), default="active")
    created_by   = db.Column(db.Integer, db.ForeignKey("admin_users.admin_id"))
    created_at   = db.Column(db.DateTime(timezone=True), default=now_utc)
    updated_at   = db.Column(db.DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    def to_dict(self):
        return {
            "admin_id":     self.admin_id,
            "name":         self.name,
            "email":        self.email,
            "role":         self.role,
            "hostel_block": self.hostel_block,
            "status":       self.status,
        }


class StudentPreference(db.Model):
    __tablename__ = "student_preferences"

    preference_id     = db.Column(db.Integer, primary_key=True)
    student_id        = db.Column(db.Integer, db.ForeignKey("students.student_id"),
                                  unique=True, nullable=False)
    wake_time         = db.Column(db.Integer, nullable=False)
    sleep_time        = db.Column(db.Integer, nullable=False)
    noise_tolerance   = db.Column(db.Integer, nullable=False)
    cleanliness_level = db.Column(db.Integer, nullable=False)
    guest_policy      = db.Column(db.Integer, nullable=False)
    bathroom_schedule = db.Column(db.Integer, nullable=False)
    study_habits      = db.Column(db.String(20), nullable=False)
    additional_notes  = db.Column(db.Text)
    is_locked         = db.Column(db.Boolean, default=False)
    created_at        = db.Column(db.DateTime(timezone=True), default=now_utc)
    updated_at        = db.Column(db.DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    def to_dict(self):
        return {
            "preference_id":     self.preference_id,
            "student_id":        self.student_id,
            "wake_time":         self.wake_time,
            "sleep_time":        self.sleep_time,
            "noise_tolerance":   self.noise_tolerance,
            "cleanliness_level": self.cleanliness_level,
            "guest_policy":      self.guest_policy,
            "bathroom_schedule": self.bathroom_schedule,
            "study_habits":      self.study_habits,
            "additional_notes":  self.additional_notes,
            "is_locked":         self.is_locked,
        }
```

### 4.4 App Factory — `backend/app/__init__.py`

```python
from flask import Flask
from .config import Config
from .extensions import db, jwt, bcrypt, cors

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Initialise extensions
    db.init_app(app)
    jwt.init_app(app)
    bcrypt.init_app(app)
    cors.init_app(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})

    # Register blueprints
    from .routes.auth        import auth_bp
    from .routes.students    import students_bp
    from .routes.preferences import preferences_bp
    from .routes.admin       import admin_bp

    app.register_blueprint(auth_bp,        url_prefix="/api/auth")
    app.register_blueprint(students_bp,    url_prefix="/api/students")
    app.register_blueprint(preferences_bp, url_prefix="/api/preferences")
    app.register_blueprint(admin_bp,       url_prefix="/api/admin")

    return app
```

### 4.5 Entry Point — `backend/run.py`

```python
from app import create_app

app = create_app()

if __name__ == "__main__":
    app.run(debug=True, port=5000)
```

---

## 5. RBAC Decorator — `backend/app/routes/__init__.py`

```python
from functools import wraps
from flask import jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt

def role_required(*roles):
    """
    Usage:
        @role_required("admin")
        @role_required("admin", "resident_advisor")
    """
    def wrapper(fn):
        @wraps(fn)
        def decorated(*args, **kwargs):
            verify_jwt_in_request()
            claims = get_jwt()
            user_role = claims.get("role")
            if user_role not in roles:
                return jsonify({"error": "Access denied"}), 403
            return fn(*args, **kwargs)
        return decorated
    return wrapper
```

---

## 6. Authentication Routes — `backend/app/routes/auth.py`

```python
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required
from email_validator import validate_email, EmailNotValidError
from ..extensions import db, bcrypt
from ..models import Student, AdminUser

auth_bp = Blueprint("auth", __name__)


# ── STUDENT REGISTRATION ──────────────────────────────────────────────────────
@auth_bp.route("/register", methods=["POST"])
def register_student():
    data = request.get_json()

    # Required field check
    required = ["name", "email", "password", "student_number", "year", "gender"]
    missing  = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({"error": f"Missing required fields: {', '.join(missing)}"}), 400

    # Email format validation
    try:
        validate_email(data["email"])
    except EmailNotValidError:
        return jsonify({"error": "Invalid email address"}), 400

    # Password length
    if len(data["password"]) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400

    # Year range
    try:
        year = int(data["year"])
        if year < 1 or year > 6:
            raise ValueError
    except (ValueError, TypeError):
        return jsonify({"error": "Year of study must be between 1 and 6"}), 400

    # Gender validation
    valid_genders = ["male", "female", "prefer_not_to_say"]
    if data["gender"].lower() not in valid_genders:
        return jsonify({"error": "Gender must be male, female, or prefer_not_to_say"}), 400

    # Uniqueness checks
    if Student.query.filter_by(email=data["email"]).first():
        return jsonify({"error": "An account with this email already exists"}), 409
    if Student.query.filter_by(student_number=data["student_number"]).first():
        return jsonify({"error": "This student number is already registered"}), 409

    # Hash password and create record
    hashed_pw = bcrypt.generate_password_hash(data["password"]).decode("utf-8")

    student = Student(
        name           = data["name"].strip(),
        email          = data["email"].strip().lower(),
        password       = hashed_pw,
        student_number = data["student_number"].strip().upper(),
        year           = year,
        phone          = data.get("phone", "").strip() or None,
        gender         = data["gender"].lower(),
        status         = "active",
    )

    db.session.add(student)
    db.session.commit()

    return jsonify({
        "message":    "Registration successful. Please log in.",
        "student_id": student.student_id,
    }), 201


# ── UNIFIED LOGIN ─────────────────────────────────────────────────────────────
@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    email    = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    # Check students table first
    user      = Student.query.filter_by(email=email, status="active").first()
    role      = "student"
    user_id   = None
    user_data = None

    if user:
        user_id   = user.student_id
        user_data = user.to_dict()
    else:
        # Check admin_users table
        admin = AdminUser.query.filter_by(email=email, status="active").first()
        if admin:
            user      = admin
            role      = admin.role
            user_id   = admin.admin_id
            user_data = admin.to_dict()

    # Validate password
    if not user or not bcrypt.check_password_hash(user.password, password):
        return jsonify({"error": "Invalid email or password"}), 401

    # Build JWT with role embedded
    token = create_access_token(
        identity=str(user_id),
        additional_claims={
            "role":         role,
            "name":         user.name,
            "hostel_block": getattr(user, "hostel_block", None),
        }
    )

    return jsonify({
        "token":    token,
        "role":     role,
        "name":     user.name,
        "user":     user_data,
    }), 200


# ── GET CURRENT USER ──────────────────────────────────────────────────────────
@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def get_current_user():
    from flask_jwt_extended import get_jwt
    claims  = get_jwt()
    role    = claims.get("role")
    user_id = int(get_jwt_identity())

    if role == "student":
        user = Student.query.get_or_404(user_id)
        return jsonify(user.to_dict()), 200
    else:
        user = AdminUser.query.get_or_404(user_id)
        return jsonify(user.to_dict()), 200
```

---

## 7. Student Routes — `backend/app/routes/students.py`

```python
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from ..extensions import db
from ..models import Student
from . import role_required

students_bp = Blueprint("students", __name__)


@students_bp.route("/<int:student_id>", methods=["GET"])
@jwt_required()
def get_student(student_id):
    claims      = get_jwt()
    role        = claims.get("role")
    current_uid = int(get_jwt_identity())

    # Students can only view their own profile
    if role == "student" and current_uid != student_id:
        return jsonify({"error": "Access denied"}), 403

    student = Student.query.get_or_404(student_id)
    return jsonify(student.to_dict()), 200
```

---

## 8. Preferences Routes — `backend/app/routes/preferences.py`

```python
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from ..extensions import db
from ..models import StudentPreference, Student
from . import role_required

preferences_bp = Blueprint("preferences", __name__)

VALID_STUDY_HABITS = ("quiet", "group", "flexible")


def validate_preference_data(data):
    """Returns list of error strings or empty list if valid."""
    errors = []
    int_fields = {
        "wake_time":         (1, 5),
        "sleep_time":        (1, 5),
        "noise_tolerance":   (1, 5),
        "cleanliness_level": (1, 5),
        "guest_policy":      (1, 5),
        "bathroom_schedule": (1, 3),
    }
    for field, (mn, mx) in int_fields.items():
        val = data.get(field)
        try:
            val = int(val)
            if val < mn or val > mx:
                errors.append(f"{field} must be between {mn} and {mx}")
        except (TypeError, ValueError):
            errors.append(f"{field} is required and must be a number")

    if data.get("study_habits") not in VALID_STUDY_HABITS:
        errors.append("study_habits must be quiet, group, or flexible")

    return errors


# ── SUBMIT PREFERENCES ────────────────────────────────────────────────────────
@preferences_bp.route("/", methods=["POST"])
@jwt_required()
def submit_preferences():
    claims      = get_jwt()
    role        = claims.get("role")
    student_id  = int(get_jwt_identity())

    if role != "student":
        return jsonify({"error": "Only students can submit preferences"}), 403

    # Check student exists
    student = Student.query.get_or_404(student_id)

    # Check if preferences already exist
    if student.preferences:
        if student.preferences.is_locked:
            return jsonify({"error": "Preferences are locked for this semester"}), 403
        # If exists and not locked, update instead
        return update_preferences(student_id)

    data   = request.get_json()
    errors = validate_preference_data(data)
    if errors:
        return jsonify({"errors": errors}), 400

    pref = StudentPreference(
        student_id        = student_id,
        wake_time         = int(data["wake_time"]),
        sleep_time        = int(data["sleep_time"]),
        noise_tolerance   = int(data["noise_tolerance"]),
        cleanliness_level = int(data["cleanliness_level"]),
        guest_policy      = int(data["guest_policy"]),
        bathroom_schedule = int(data["bathroom_schedule"]),
        study_habits      = data["study_habits"],
        additional_notes  = data.get("additional_notes", ""),
    )

    db.session.add(pref)
    db.session.commit()

    return jsonify({
        "message":    "Preferences submitted successfully",
        "preference": pref.to_dict(),
    }), 201


# ── GET PREFERENCES ───────────────────────────────────────────────────────────
@preferences_bp.route("/<int:student_id>", methods=["GET"])
@jwt_required()
def get_preferences(student_id):
    claims      = get_jwt()
    role        = claims.get("role")
    current_uid = int(get_jwt_identity())

    # Students can only read their own preferences
    if role == "student" and current_uid != student_id:
        return jsonify({"error": "Access denied"}), 403

    student = Student.query.get_or_404(student_id)

    if not student.preferences:
        return jsonify({"preferences": None, "submitted": False}), 200

    return jsonify({
        "preferences": student.preferences.to_dict(),
        "submitted":   True,
    }), 200


# ── UPDATE PREFERENCES ────────────────────────────────────────────────────────
@preferences_bp.route("/", methods=["PUT"])
@jwt_required()
def update_preferences(student_id=None):
    claims     = get_jwt()
    role       = claims.get("role")
    current_id = int(get_jwt_identity())

    if role != "student":
        return jsonify({"error": "Only students can update preferences"}), 403

    sid     = student_id or current_id
    student = Student.query.get_or_404(sid)

    if not student.preferences:
        return jsonify({"error": "No preferences found. Submit preferences first."}), 404

    if student.preferences.is_locked:
        return jsonify({"error": "Preferences are locked for this semester"}), 403

    data   = request.get_json()
    errors = validate_preference_data(data)
    if errors:
        return jsonify({"errors": errors}), 400

    pref = student.preferences
    pref.wake_time         = int(data["wake_time"])
    pref.sleep_time        = int(data["sleep_time"])
    pref.noise_tolerance   = int(data["noise_tolerance"])
    pref.cleanliness_level = int(data["cleanliness_level"])
    pref.guest_policy      = int(data["guest_policy"])
    pref.bathroom_schedule = int(data["bathroom_schedule"])
    pref.study_habits      = data["study_habits"]
    pref.additional_notes  = data.get("additional_notes", "")

    db.session.commit()

    return jsonify({
        "message":    "Preferences updated successfully",
        "preference": pref.to_dict(),
    }), 200
```

---

## 9. Admin Routes — `backend/app/routes/admin.py`

```python
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from ..extensions import db, bcrypt
from ..models import AdminUser, Student
from . import role_required

admin_bp = Blueprint("admin", __name__)


# ── CREATE STAFF ACCOUNT (admin or resident_advisor) ─────────────────────────
@admin_bp.route("/users", methods=["POST"])
@role_required("admin")
def create_staff_account():
    data     = request.get_json()
    admin_id = int(get_jwt_identity())

    required = ["name", "email", "password", "role"]
    missing  = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({"error": f"Missing: {', '.join(missing)}"}), 400

    if data["role"] not in ("admin", "resident_advisor"):
        return jsonify({"error": "Role must be admin or resident_advisor"}), 400

    if data["role"] == "resident_advisor" and not data.get("hostel_block"):
        return jsonify({"error": "hostel_block is required for Resident Advisors"}), 400

    if AdminUser.query.filter_by(email=data["email"]).first():
        return jsonify({"error": "Email already registered"}), 409

    hashed = bcrypt.generate_password_hash(data["password"]).decode("utf-8")

    user = AdminUser(
        name         = data["name"].strip(),
        email        = data["email"].strip().lower(),
        password     = hashed,
        role         = data["role"],
        hostel_block = data.get("hostel_block"),
        created_by   = admin_id,
        status       = "active",
    )
    db.session.add(user)
    db.session.commit()

    return jsonify({
        "message": f"{data['role']} account created",
        "user":    user.to_dict(),
    }), 201


# ── GET ALL STUDENTS (with preference status) ─────────────────────────────────
@admin_bp.route("/students", methods=["GET"])
@role_required("admin", "resident_advisor")
def get_all_students():
    students = Student.query.filter_by(status="active").order_by(
        Student.created_at.desc()
    ).all()

    result = []
    for s in students:
        d = s.to_dict()
        d["preferences_status"] = "submitted" if s.preferences else "not_submitted"
        result.append(d)

    return jsonify({
        "students":      result,
        "total":         len(result),
        "submitted":     sum(1 for s in result if s["preferences_status"] == "submitted"),
        "not_submitted": sum(1 for s in result if s["preferences_status"] == "not_submitted"),
    }), 200


# ── DISABLE STUDENT ACCOUNT ────────────────────────────────────────────────────
@admin_bp.route("/students/<int:student_id>/disable", methods=["PATCH"])
@role_required("admin")
def disable_student(student_id):
    student = Student.query.get_or_404(student_id)
    student.status = "inactive"
    db.session.commit()
    return jsonify({"message": f"Student {student.name} account deactivated"}), 200
```

---

## 10. Frontend Setup

### 10.1 Axios Instance — `frontend/src/api/axios.js`

```javascript
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Attach JWT token to every request automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Redirect to login on 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.clear();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;
```

### 10.2 Auth Context — `frontend/src/context/AuthContext.jsx`

```jsx
import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,  setUser]  = useState(null);
  const [role,  setRole]  = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));

  useEffect(() => {
    const storedUser  = localStorage.getItem("user");
    const storedRole  = localStorage.getItem("role");
    if (storedUser && storedRole) {
      setUser(JSON.parse(storedUser));
      setRole(storedRole);
    }
  }, []);

  const login = (data) => {
    localStorage.setItem("token", data.token);
    localStorage.setItem("role",  data.role);
    localStorage.setItem("user",  JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    setRole(data.role);
  };

  const logout = () => {
    localStorage.clear();
    setToken(null);
    setUser(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, role, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

### 10.3 Protected Route — `frontend/src/components/ProtectedRoute.jsx`

```jsx
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, allowedRoles }) {
  const { token, role } = useAuth();

  if (!token) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/unauthorized" replace />;
  }
  return children;
}
```

### 10.4 App Router — `frontend/src/App.jsx`

```jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute    from "./components/ProtectedRoute";

import StudentRegister  from "./pages/auth/StudentRegister";
import Login            from "./pages/auth/Login";
import StudentDashboard from "./pages/dashboards/StudentDashboard";
import AdminDashboard   from "./pages/dashboards/AdminDashboard";
import RADashboard      from "./pages/dashboards/RADashboard";
import PreferenceForm   from "./pages/preferences/PreferenceForm";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/"         element={<Navigate to="/login" replace />} />
          <Route path="/register" element={<StudentRegister />} />
          <Route path="/login"    element={<Login />} />

          {/* Student */}
          <Route path="/student/dashboard" element={
            <ProtectedRoute allowedRoles={["student"]}>
              <StudentDashboard />
            </ProtectedRoute>
          } />
          <Route path="/student/preferences" element={
            <ProtectedRoute allowedRoles={["student"]}>
              <PreferenceForm />
            </ProtectedRoute>
          } />

          {/* Admin */}
          <Route path="/admin/dashboard" element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <AdminDashboard />
            </ProtectedRoute>
          } />

          {/* Resident Advisor */}
          <Route path="/ra/dashboard" element={
            <ProtectedRoute allowedRoles={["resident_advisor"]}>
              <RADashboard />
            </ProtectedRoute>
          } />

          <Route path="/unauthorized" element={<h2>403 — Access Denied</h2>} />
          <Route path="*"            element={<h2>404 — Page Not Found</h2>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
```

---

## 11. Registration Page (Student)

**File:** `frontend/src/pages/auth/StudentRegister.jsx`

### Fields Required:

| Field | Type | Validation |
|-------|------|-----------|
| Full Name | Text | Required, min 2 chars |
| Student Number | Text | Required, unique, uppercase |
| Email Address | Email | Required, valid format |
| Gender | Select | male / female / prefer_not_to_say |
| Year of Study | Select | 1 through 6 |
| Phone Number | Tel | Optional |
| Password | Password | Required, min 8 chars |
| Confirm Password | Password | Must match password |

```jsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../../api/axios";

export default function StudentRegister() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name:           "",
    student_number: "",
    email:          "",
    gender:         "",
    year:           "",
    phone:          "",
    password:       "",
    confirmPassword:"",
  });

  const [errors,  setErrors]  = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" });
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim())           e.name           = "Full name is required";
    if (!form.student_number.trim()) e.student_number = "Student number is required";
    if (!form.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/))
                                     e.email          = "Valid email is required";
    if (!form.gender)                e.gender         = "Please select your gender";
    if (!form.year)                  e.year           = "Year of study is required";
    if (form.password.length < 8)    e.password       = "Password must be at least 8 characters";
    if (form.password !== form.confirmPassword)
                                     e.confirmPassword = "Passwords do not match";
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/register", {
        name:           form.name,
        student_number: form.student_number.toUpperCase(),
        email:          form.email,
        gender:         form.gender,
        year:           parseInt(form.year),
        phone:          form.phone || undefined,
        password:       form.password,
      });
      setSuccess(true);
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      const msg = err.response?.data?.error || "Registration failed. Try again.";
      setErrors({ server: msg });
    } finally {
      setLoading(false);
    }
  };

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h2 style={styles.title}>Student Registration</h2>
        <p style={styles.subtitle}>Hostel Roommate Compatibility System</p>

        {success && (
          <div style={styles.successBanner}>
            Registration successful! Redirecting to login...
          </div>
        )}
        {errors.server && (
          <div style={styles.errorBanner}>{errors.server}</div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* Full Name */}
          <Field
            label="Full Name"
            name="name"
            type="text"
            value={form.name}
            onChange={handleChange}
            error={errors.name}
            placeholder="e.g. Jane Achieng"
          />

          {/* Student Number */}
          <Field
            label="Student Number"
            name="student_number"
            type="text"
            value={form.student_number}
            onChange={handleChange}
            error={errors.student_number}
            placeholder="e.g. UON/2022/12345"
          />

          {/* Email */}
          <Field
            label="Email Address"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            error={errors.email}
            placeholder="student@university.ac.ke"
          />

          {/* Gender */}
          <div style={styles.field}>
            <label style={styles.label}>Gender</label>
            <select
              name="gender"
              value={form.gender}
              onChange={handleChange}
              style={styles.input}
            >
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
            {errors.gender && <span style={styles.error}>{errors.gender}</span>}
          </div>

          {/* Year of Study */}
          <div style={styles.field}>
            <label style={styles.label}>Year of Study</label>
            <select
              name="year"
              value={form.year}
              onChange={handleChange}
              style={styles.input}
            >
              <option value="">Select year</option>
              {[1,2,3,4,5,6].map(y => (
                <option key={y} value={y}>Year {y}</option>
              ))}
            </select>
            {errors.year && <span style={styles.error}>{errors.year}</span>}
          </div>

          {/* Phone (optional) */}
          <Field
            label="Phone Number (optional)"
            name="phone"
            type="tel"
            value={form.phone}
            onChange={handleChange}
            error={errors.phone}
            placeholder="+254 7XX XXX XXX"
          />

          {/* Password */}
          <Field
            label="Password"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            error={errors.password}
            placeholder="Minimum 8 characters"
          />

          {/* Confirm Password */}
          <Field
            label="Confirm Password"
            name="confirmPassword"
            type="password"
            value={form.confirmPassword}
            onChange={handleChange}
            error={errors.confirmPassword}
            placeholder="Repeat your password"
          />

          <button type="submit" style={styles.btn} disabled={loading}>
            {loading ? "Registering..." : "Create Account"}
          </button>
        </form>

        <p style={{ textAlign:"center", marginTop:16 }}>
          Already have an account? <Link to="/login">Login here</Link>
        </p>
      </div>
    </div>
  );
}

// ── Reusable field component ──────────────────────────────────────────────────
function Field({ label, name, type, value, onChange, error, placeholder }) {
  return (
    <div style={styles.field}>
      <label style={styles.label}>{label}</label>
      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={{ ...styles.input, ...(error ? styles.inputError : {}) }}
      />
      {error && <span style={styles.error}>{error}</span>}
    </div>
  );
}

const styles = {
  page:          { minHeight:"100vh", display:"flex", justifyContent:"center", alignItems:"center", background:"#f0f4f8", padding:20 },
  card:          { background:"#fff", borderRadius:12, padding:40, width:"100%", maxWidth:480, boxShadow:"0 4px 20px rgba(0,0,0,0.1)" },
  title:         { margin:0, fontSize:24, fontWeight:700, color:"#1A3C5E" },
  subtitle:      { color:"#666", fontSize:14, marginBottom:24 },
  field:         { marginBottom:16 },
  label:         { display:"block", fontSize:13, fontWeight:600, color:"#333", marginBottom:4 },
  input:         { width:"100%", padding:"10px 12px", border:"1px solid #ccc", borderRadius:6, fontSize:14, boxSizing:"border-box" },
  inputError:    { borderColor:"#e74c3c" },
  error:         { color:"#e74c3c", fontSize:12, marginTop:4, display:"block" },
  btn:           { width:"100%", padding:"12px", background:"#1A3C5E", color:"#fff", border:"none", borderRadius:6, fontSize:16, fontWeight:600, cursor:"pointer", marginTop:8 },
  successBanner: { background:"#d4edda", color:"#155724", padding:12, borderRadius:6, marginBottom:16, textAlign:"center" },
  errorBanner:   { background:"#f8d7da", color:"#721c24", padding:12, borderRadius:6, marginBottom:16, textAlign:"center" },
};
```

---

## 12. Login Page

**File:** `frontend/src/pages/auth/Login.jsx`

### Fields Required:

| Field | Type | Validation |
|-------|------|-----------|
| Email | Email | Required |
| Password | Password | Required |

```jsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [form,    setForm]    = useState({ email: "", password: "" });
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      setError("Both email and password are required");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res  = await api.post("/auth/login", form);
      const data = res.data;

      login(data);   // save token + role + user to context and localStorage

      // Route by role
      if (data.role === "admin")             navigate("/admin/dashboard");
      else if (data.role === "resident_advisor") navigate("/ra/dashboard");
      else                                   navigate("/student/dashboard");

    } catch (err) {
      setError(err.response?.data?.error || "Login failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h2 style={styles.title}>Welcome Back</h2>
        <p style={styles.subtitle}>Hostel Roommate Compatibility System</p>

        {error && <div style={styles.errorBanner}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={styles.field}>
            <label style={styles.label}>Email Address</label>
            <input
              name="email" type="email" value={form.email}
              onChange={handleChange} placeholder="your@email.com"
              style={styles.input}
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              name="password" type="password" value={form.password}
              onChange={handleChange} placeholder="Your password"
              style={styles.input}
            />
          </div>

          <button type="submit" style={styles.btn} disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p style={{ textAlign:"center", marginTop:16 }}>
          New student? <Link to="/register">Register here</Link>
        </p>
      </div>
    </div>
  );
}

const styles = {
  page:        { minHeight:"100vh", display:"flex", justifyContent:"center", alignItems:"center", background:"#f0f4f8" },
  card:        { background:"#fff", borderRadius:12, padding:40, width:"100%", maxWidth:420, boxShadow:"0 4px 20px rgba(0,0,0,0.1)" },
  title:       { margin:0, fontSize:24, fontWeight:700, color:"#1A3C5E" },
  subtitle:    { color:"#666", fontSize:14, marginBottom:24 },
  field:       { marginBottom:16 },
  label:       { display:"block", fontSize:13, fontWeight:600, color:"#333", marginBottom:4 },
  input:       { width:"100%", padding:"10px 12px", border:"1px solid #ccc", borderRadius:6, fontSize:14, boxSizing:"border-box" },
  btn:         { width:"100%", padding:12, background:"#1A3C5E", color:"#fff", border:"none", borderRadius:6, fontSize:16, fontWeight:600, cursor:"pointer", marginTop:8 },
  errorBanner: { background:"#f8d7da", color:"#721c24", padding:12, borderRadius:6, marginBottom:16, textAlign:"center" },
};
```

---

## 13. Student Dashboard

**File:** `frontend/src/pages/dashboards/StudentDashboard.jsx`

### What to show:
- Welcome message with student name
- **If preferences NOT submitted:** prominent banner with button → `/student/preferences`
- **If preferences submitted:** summary of submitted preferences
- Assignment details panel (placeholder — shows "No assignment yet" until admin generates)
- Conflict history section (placeholder)
- Logout button

```jsx
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";

export default function StudentDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [prefData, setPrefData] = useState(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        const res = await api.get(`/preferences/${user.student_id}`);
        setPrefData(res.data);
      } catch {
        setPrefData({ submitted: false });
      } finally {
        setLoading(false);
      }
    };
    if (user?.student_id) fetchPreferences();
  }, [user]);

  const handleLogout = () => { logout(); navigate("/login"); };

  if (loading) return <p style={{ padding:40 }}>Loading dashboard...</p>;

  return (
    <div style={styles.page}>

      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.welcomeText}>Hello, {user?.name} 👋</h1>
          <p style={styles.sub}>Student No: {user?.student_number}</p>
        </div>
        <button onClick={handleLogout} style={styles.logoutBtn}>Logout</button>
      </div>

      {/* Preference Prompt or Summary */}
      {!prefData?.submitted ? (
        <div style={styles.warningBanner}>
          <strong>⚠️ Preferences not submitted</strong>
          <p>You must complete your lifestyle preference form before roommate assignments can be generated.</p>
          <Link to="/student/preferences">
            <button style={styles.primaryBtn}>Complete Preferences →</button>
          </Link>
        </div>
      ) : (
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>✅ Preferences Submitted</h3>
          <div style={styles.prefGrid}>
            <PrefItem label="Wake Time"         value={prefData.preferences?.wake_time} scale={5} />
            <PrefItem label="Sleep Time"        value={prefData.preferences?.sleep_time} scale={5} />
            <PrefItem label="Noise Tolerance"   value={prefData.preferences?.noise_tolerance} scale={5} />
            <PrefItem label="Cleanliness"       value={prefData.preferences?.cleanliness_level} scale={5} />
            <PrefItem label="Guest Policy"      value={prefData.preferences?.guest_policy} scale={5} />
            <PrefItem label="Bathroom Schedule" value={prefData.preferences?.bathroom_schedule} scale={3} />
          </div>
          <p style={{ marginTop:8 }}>
            <strong>Study Habits:</strong> {prefData.preferences?.study_habits}
          </p>
          {!prefData.preferences?.is_locked && (
            <Link to="/student/preferences">
              <button style={{ ...styles.primaryBtn, marginTop:12 }}>Update Preferences</button>
            </Link>
          )}
          {prefData.preferences?.is_locked && (
            <p style={{ color:"#e67e22", fontSize:13, marginTop:8 }}>
              🔒 Preferences are locked for this semester.
            </p>
          )}
        </div>
      )}

      {/* Assignment Panel — placeholder */}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>🏠 Room Assignment</h3>
        <p style={{ color:"#888" }}>
          No room assignment yet. Assignments will appear here once the hostel administrator
          completes the matching process for your semester.
        </p>
      </div>

      {/* Conflict History — placeholder */}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>📋 Conflict History</h3>
        <p style={{ color:"#888" }}>No conflict records found.</p>
      </div>

    </div>
  );
}

function PrefItem({ label, value, scale }) {
  return (
    <div style={{ marginBottom:8 }}>
      <span style={{ fontWeight:600, fontSize:13 }}>{label}: </span>
      <span style={{ fontSize:13, color:"#1A3C5E" }}>{value} / {scale}</span>
    </div>
  );
}

const styles = {
  page:          { maxWidth:800, margin:"0 auto", padding:24 },
  header:        { display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24 },
  welcomeText:   { margin:0, fontSize:22, color:"#1A3C5E" },
  sub:           { color:"#888", fontSize:13, margin:0 },
  logoutBtn:     { padding:"8px 16px", background:"#e74c3c", color:"#fff", border:"none", borderRadius:6, cursor:"pointer" },
  warningBanner: { background:"#fff3cd", border:"1px solid #ffc107", borderRadius:8, padding:20, marginBottom:20 },
  card:          { background:"#fff", borderRadius:8, padding:20, marginBottom:16, boxShadow:"0 2px 8px rgba(0,0,0,0.08)" },
  cardTitle:     { margin:"0 0 12px", color:"#1A3C5E", fontSize:16 },
  prefGrid:      { display:"grid", gridTemplateColumns:"1fr 1fr", gap:4 },
  primaryBtn:    { padding:"10px 20px", background:"#1A3C5E", color:"#fff", border:"none", borderRadius:6, cursor:"pointer", fontWeight:600 },
};
```

---

## 14. Admin Dashboard

**File:** `frontend/src/pages/dashboards/AdminDashboard.jsx`

### What to show:
- Header with admin name + logout
- Summary stats: total students, preferences submitted, not submitted
- Full table of registered students showing:
  - Name, Student Number, Year, Gender
  - **Preferences status** — green "Submitted" or red "Not Submitted" badge
  - Date registered
- Placeholder panels for Assignments and Conflicts (non-functional)

```jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [data,    setData]    = useState({ students:[], total:0, submitted:0, not_submitted:0 });
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get("/admin/students");
        setData(res.data);
      } catch {
        console.error("Failed to load students");
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const handleLogout = () => { logout(); navigate("/login"); };

  const filtered = data.students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.student_number.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={styles.page}>

      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Admin Dashboard</h1>
          <p style={styles.sub}>Welcome, {user?.name}</p>
        </div>
        <button onClick={handleLogout} style={styles.logoutBtn}>Logout</button>
      </div>

      {/* Summary Cards */}
      <div style={styles.statRow}>
        <StatCard label="Total Students"      value={data.total}         color="#1A3C5E" />
        <StatCard label="Preferences Submitted" value={data.submitted}     color="#27AE60" />
        <StatCard label="Not Submitted"       value={data.not_submitted}  color="#e74c3c" />
      </div>

      {/* Student Table */}
      <div style={styles.card}>
        <div style={styles.tableHeader}>
          <h3 style={{ margin:0, color:"#1A3C5E" }}>Registered Students</h3>
          <input
            placeholder="Search by name or student number..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={styles.search}
          />
        </div>

        {loading ? (
          <p>Loading students...</p>
        ) : (
          <div style={{ overflowX:"auto" }}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.thead}>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>Student No.</th>
                  <th style={styles.th}>Year</th>
                  <th style={styles.th}>Gender</th>
                  <th style={styles.th}>Preferences</th>
                  <th style={styles.th}>Registered</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign:"center", padding:20, color:"#888" }}>
                      No students found
                    </td>
                  </tr>
                )}
                {filtered.map((s, i) => (
                  <tr key={s.student_id} style={{ background: i%2===0 ? "#fff" : "#f8fbff" }}>
                    <td style={styles.td}>{s.name}</td>
                    <td style={styles.td}>{s.student_number}</td>
                    <td style={styles.td}>Year {s.year}</td>
                    <td style={styles.td} style={{ textTransform:"capitalize" }}>{s.gender?.replace("_"," ")}</td>
                    <td style={styles.td}>
                      {s.preferences_status === "submitted" ? (
                        <span style={styles.badgeGreen}>✓ Submitted</span>
                      ) : (
                        <span style={styles.badgeRed}>✗ Not Submitted</span>
                      )}
                    </td>
                    <td style={styles.td}>
                      {s.created_at ? new Date(s.created_at).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Placeholder panels */}
      <div style={styles.placeholderRow}>
        <div style={styles.placeholder}>
          <h3 style={{ color:"#1A3C5E" }}>🏠 Room Assignments</h3>
          <p style={{ color:"#888" }}>Assignment management coming soon. Generate pairings once all preferences are collected.</p>
        </div>
        <div style={styles.placeholder}>
          <h3 style={{ color:"#1A3C5E" }}>📋 Conflict Logs</h3>
          <p style={{ color:"#888" }}>Conflict tracking will appear here once resident advisors begin logging disputes.</p>
        </div>
      </div>

    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{ ...styles.statCard, borderTop:`4px solid ${color}` }}>
      <div style={{ fontSize:32, fontWeight:700, color }}>{value}</div>
      <div style={{ fontSize:13, color:"#666" }}>{label}</div>
    </div>
  );
}

const styles = {
  page:           { maxWidth:1100, margin:"0 auto", padding:24 },
  header:         { display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24 },
  title:          { margin:0, fontSize:22, color:"#1A3C5E" },
  sub:            { color:"#888", fontSize:13, margin:0 },
  logoutBtn:      { padding:"8px 16px", background:"#e74c3c", color:"#fff", border:"none", borderRadius:6, cursor:"pointer" },
  statRow:        { display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16, marginBottom:20 },
  statCard:       { background:"#fff", borderRadius:8, padding:20, boxShadow:"0 2px 8px rgba(0,0,0,0.08)", textAlign:"center" },
  card:           { background:"#fff", borderRadius:8, padding:20, marginBottom:16, boxShadow:"0 2px 8px rgba(0,0,0,0.08)" },
  tableHeader:    { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:12 },
  search:         { padding:"8px 12px", border:"1px solid #ccc", borderRadius:6, fontSize:14, minWidth:260 },
  table:          { width:"100%", borderCollapse:"collapse" },
  thead:          { background:"#1A3C5E" },
  th:             { color:"#fff", padding:"10px 14px", textAlign:"left", fontSize:13, fontWeight:600 },
  td:             { padding:"10px 14px", fontSize:13, borderBottom:"1px solid #eee" },
  badgeGreen:     { background:"#d4edda", color:"#155724", padding:"3px 10px", borderRadius:12, fontSize:12, fontWeight:600 },
  badgeRed:       { background:"#f8d7da", color:"#721c24", padding:"3px 10px", borderRadius:12, fontSize:12, fontWeight:600 },
  placeholderRow: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 },
  placeholder:    { background:"#fff", borderRadius:8, padding:20, boxShadow:"0 2px 8px rgba(0,0,0,0.08)" },
};
```

---

## 15. Resident Advisor Dashboard

**File:** `frontend/src/pages/dashboards/RADashboard.jsx`

```jsx
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function RADashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div style={{ maxWidth:800, margin:"0 auto", padding:24 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <div>
          <h1 style={{ margin:0, color:"#1A3C5E" }}>Resident Advisor Dashboard</h1>
          <p style={{ color:"#888", margin:0 }}>{user?.name} — Block {user?.hostel_block || "Unassigned"}</p>
        </div>
        <button onClick={() => { logout(); navigate("/login"); }}
          style={{ padding:"8px 16px", background:"#e74c3c", color:"#fff", border:"none", borderRadius:6, cursor:"pointer" }}>
          Logout
        </button>
      </div>

      {/* Conflict Logging — placeholder */}
      <div style={{ background:"#fff", borderRadius:8, padding:20, marginBottom:16, boxShadow:"0 2px 8px rgba(0,0,0,0.08)" }}>
        <h3 style={{ margin:"0 0 12px", color:"#1A3C5E" }}>📋 Log a Conflict</h3>
        <p style={{ color:"#888" }}>Conflict logging form — coming in next module.</p>
      </div>

      {/* Active conflicts — placeholder */}
      <div style={{ background:"#fff", borderRadius:8, padding:20, boxShadow:"0 2px 8px rgba(0,0,0,0.08)" }}>
        <h3 style={{ margin:"0 0 12px", color:"#1A3C5E" }}>⚠️ Active Conflicts in Block {user?.hostel_block}</h3>
        <p style={{ color:"#888" }}>No active conflicts reported.</p>
      </div>
    </div>
  );
}
```

---

## 16. Preference Form (FUNCTIONAL)

**File:** `frontend/src/pages/preferences/PreferenceForm.jsx`

### Fields and Scale:

| Field | Input Type | Scale / Options |
|-------|-----------|----------------|
| Wake Time | Slider | 1 (5AM) → 5 (10AM+) |
| Sleep Time | Slider | 1 (9PM) → 5 (1AM+) |
| Noise Tolerance | Slider | 1 (Silence needed) → 5 (Loud is fine) |
| Cleanliness Level | Slider | 1 (Very messy) → 5 (Obsessively tidy) |
| Guest Policy | Slider | 1 (No guests) → 5 (Guests daily) |
| Bathroom Schedule | Radio | Morning / Evening / Flexible |
| Study Habits | Radio | Quiet / Group / Flexible |
| Additional Notes | Textarea | Optional |

```jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";

const WAKE_LABELS  = { 1:"Very Early (5AM)", 2:"Early (6:30AM)", 3:"Normal (7:30AM)", 4:"Late (9AM)",  5:"Very Late (10AM+)" };
const SLEEP_LABELS = { 1:"Very Early (9PM)", 2:"Early (10PM)",   3:"Normal (11PM)",   4:"Late (12AM)", 5:"Very Late (1AM+)" };
const NOISE_LABELS = { 1:"Silence needed",   2:"Mostly quiet",   3:"Some noise ok",   4:"Fairly loud", 5:"Loud is fine"     };
const CLEAN_LABELS = { 1:"Very messy",       2:"Somewhat messy", 3:"Average",         4:"Fairly tidy", 5:"Obsessively tidy" };
const GUEST_LABELS = { 1:"No guests ever",   2:"Rarely",         3:"Sometimes",       4:"Often",       5:"Guests daily"     };

export default function PreferenceForm() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    wake_time:         3,
    sleep_time:        3,
    noise_tolerance:   3,
    cleanliness_level: 3,
    guest_policy:      3,
    bathroom_schedule: 3,
    study_habits:      "flexible",
    additional_notes:  "",
  });

  const [isEdit,   setIsEdit]   = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [message,  setMessage]  = useState({ type:"", text:"" });

  // Check if preferences already exist
  useEffect(() => {
    const check = async () => {
      try {
        const res = await api.get(`/preferences/${user.student_id}`);
        if (res.data.submitted && res.data.preferences) {
          setForm(res.data.preferences);
          setIsEdit(true);
          setIsLocked(res.data.preferences.is_locked);
        }
      } catch {
        // No preferences yet — stay in create mode
      } finally {
        setLoading(false);
      }
    };
    if (user?.student_id) check();
  }, [user]);

  const handleSlider = (e) =>
    setForm({ ...form, [e.target.name]: parseInt(e.target.value) });

  const handleRadio = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type:"", text:"" });
    try {
      if (isEdit) {
        await api.put("/preferences/", form);
        setMessage({ type:"success", text:"Preferences updated successfully!" });
      } else {
        await api.post("/preferences/", form);
        setMessage({ type:"success", text:"Preferences submitted successfully!" });
        setIsEdit(true);
      }
      setTimeout(() => navigate("/student/dashboard"), 1500);
    } catch (err) {
      const errors = err.response?.data?.errors || [err.response?.data?.error || "Submission failed"];
      setMessage({ type:"error", text: Array.isArray(errors) ? errors.join(", ") : errors });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p style={{ padding:40 }}>Loading...</p>;

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h2 style={styles.title}>
          {isEdit ? "Update Lifestyle Preferences" : "Complete Your Lifestyle Preferences"}
        </h2>
        <p style={styles.sub}>
          Your responses are used to calculate compatibility with potential roommates.
          Answer as accurately as possible.
        </p>

        {isLocked && (
          <div style={styles.lockedBanner}>
            🔒 Preferences are locked for this semester and cannot be changed.
          </div>
        )}

        {message.text && (
          <div style={message.type === "success" ? styles.successBanner : styles.errorBanner}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit}>

          {/* Sleep Schedule */}
          <fieldset style={styles.fieldset}>
            <legend style={styles.legend}>Sleep Schedule</legend>

            <SliderField
              label="Wake Time"
              name="wake_time"
              value={form.wake_time}
              onChange={handleSlider}
              disabled={isLocked}
              labelMap={WAKE_LABELS}
            />
            <SliderField
              label="Sleep Time"
              name="sleep_time"
              value={form.sleep_time}
              onChange={handleSlider}
              disabled={isLocked}
              labelMap={SLEEP_LABELS}
            />
          </fieldset>

          {/* Living Habits */}
          <fieldset style={styles.fieldset}>
            <legend style={styles.legend}>Living Habits</legend>

            <SliderField
              label="Noise Tolerance"
              name="noise_tolerance"
              value={form.noise_tolerance}
              onChange={handleSlider}
              disabled={isLocked}
              labelMap={NOISE_LABELS}
            />
            <SliderField
              label="Cleanliness Level"
              name="cleanliness_level"
              value={form.cleanliness_level}
              onChange={handleSlider}
              disabled={isLocked}
              labelMap={CLEAN_LABELS}
            />
            <SliderField
              label="Guest Policy"
              name="guest_policy"
              value={form.guest_policy}
              onChange={handleSlider}
              disabled={isLocked}
              labelMap={GUEST_LABELS}
            />
          </fieldset>

          {/* Bathroom Schedule */}
          <fieldset style={styles.fieldset}>
            <legend style={styles.legend}>Bathroom Schedule</legend>
            <RadioGroup
              name="bathroom_schedule"
              value={String(form.bathroom_schedule)}
              onChange={handleRadio}
              disabled={isLocked}
              options={[
                { value:"1", label:"Morning (5AM – 8AM)" },
                { value:"2", label:"Evening (6PM – 9PM)" },
                { value:"3", label:"Flexible (any time)" },
              ]}
            />
          </fieldset>

          {/* Study Habits */}
          <fieldset style={styles.fieldset}>
            <legend style={styles.legend}>Study Habits</legend>
            <RadioGroup
              name="study_habits"
              value={form.study_habits}
              onChange={handleRadio}
              disabled={isLocked}
              options={[
                { value:"quiet",    label:"I study in silence and need a quiet room" },
                { value:"group",    label:"I often study with friends or in groups" },
                { value:"flexible", label:"I can adapt to different study environments" },
              ]}
            />
          </fieldset>

          {/* Additional Notes */}
          <div style={styles.field}>
            <label style={styles.label}>Additional Notes (optional)</label>
            <textarea
              name="additional_notes"
              value={form.additional_notes}
              onChange={e => setForm({ ...form, additional_notes: e.target.value })}
              disabled={isLocked}
              placeholder="Anything else the system or admin should know about your living preferences..."
              rows={4}
              style={styles.textarea}
            />
          </div>

          {!isLocked && (
            <button type="submit" style={styles.btn} disabled={saving}>
              {saving ? "Saving..." : isEdit ? "Update Preferences" : "Submit Preferences"}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

// ── Slider component ──────────────────────────────────────────────────────────
function SliderField({ label, name, value, onChange, disabled, labelMap }) {
  return (
    <div style={{ marginBottom:20 }}>
      <label style={styles.label}>{label}</label>
      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
        <input
          type="range" name={name} min={1} max={5}
          value={value} onChange={onChange} disabled={disabled}
          style={{ flex:1, accentColor:"#1A3C5E" }}
        />
        <span style={styles.sliderValue}>{value}/5</span>
      </div>
      <p style={styles.sliderLabel}>{labelMap[value]}</p>
    </div>
  );
}

// ── Radio group component ─────────────────────────────────────────────────────
function RadioGroup({ name, value, onChange, options, disabled }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
      {options.map(opt => (
        <label key={opt.value} style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer", fontSize:14 }}>
          <input
            type="radio" name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={onChange}
            disabled={disabled}
            style={{ accentColor:"#1A3C5E" }}
          />
          {opt.label}
        </label>
      ))}
    </div>
  );
}

const styles = {
  page:          { minHeight:"100vh", background:"#f0f4f8", padding:24 },
  card:          { maxWidth:680, margin:"0 auto", background:"#fff", borderRadius:12, padding:32, boxShadow:"0 4px 20px rgba(0,0,0,0.1)" },
  title:         { margin:"0 0 4px", color:"#1A3C5E", fontSize:20 },
  sub:           { color:"#666", fontSize:14, marginBottom:24 },
  fieldset:      { border:"1px solid #e0e0e0", borderRadius:8, padding:16, marginBottom:20 },
  legend:        { fontWeight:700, color:"#1A3C5E", padding:"0 8px", fontSize:14 },
  field:         { marginBottom:16 },
  label:         { display:"block", fontWeight:600, fontSize:13, color:"#333", marginBottom:6 },
  sliderValue:   { fontWeight:700, color:"#1A3C5E", minWidth:30 },
  sliderLabel:   { fontSize:12, color:"#666", margin:"4px 0 0" },
  textarea:      { width:"100%", padding:"10px 12px", border:"1px solid #ccc", borderRadius:6, fontSize:14, boxSizing:"border-box", resize:"vertical" },
  btn:           { width:"100%", padding:14, background:"#1A3C5E", color:"#fff", border:"none", borderRadius:6, fontSize:16, fontWeight:600, cursor:"pointer" },
  successBanner: { background:"#d4edda", color:"#155724", padding:12, borderRadius:6, marginBottom:16 },
  errorBanner:   { background:"#f8d7da", color:"#721c24", padding:12, borderRadius:6, marginBottom:16 },
  lockedBanner:  { background:"#fff3cd", color:"#856404", padding:12, borderRadius:6, marginBottom:16 },
};
```

---

## 17. Running the Project

### Backend
```bash
cd backend
source venv/bin/activate
python run.py
# Runs on http://localhost:5000
```

### Frontend
```bash
cd frontend
npm run dev
# Runs on http://localhost:5173
```

---

## 18. API Endpoints Built in This Module

| Method | Endpoint | Access | Purpose |
|--------|----------|--------|---------|
| POST | `/api/auth/register` | Public | Student self-registration |
| POST | `/api/auth/login` | Public | Unified login (all roles) |
| GET | `/api/auth/me` | JWT | Get current user info |
| GET | `/api/students/{id}` | JWT | Get student profile |
| GET | `/api/admin/students` | Admin / RA | All students + preference status |
| POST | `/api/admin/users` | Admin | Create admin/RA account |
| PATCH | `/api/admin/students/{id}/disable` | Admin | Deactivate student |
| POST | `/api/preferences/` | Student | Submit preferences |
| GET | `/api/preferences/{id}` | JWT | Get preferences |
| PUT | `/api/preferences/` | Student | Update preferences |

---

## 19. What This Module Does NOT Build Yet

These are for the next module. Do not implement them now:

- Compatibility algorithm
- Assignment generation
- Conflict logging form
- Reporting views
- Password reset
- Admin creating room records

---

## 20. Checklist Before Handoff

- [ ] `.env` created in both backend and frontend
- [ ] `[DB_PASSWORD]` replaced with actual value in backend `.env`
- [ ] `.gitignore` includes `.env` in both folders
- [ ] `python run.py` starts without errors
- [ ] `npm run dev` starts without errors
- [ ] Student can register at `/register`
- [ ] Student can log in and see dashboard at `/student/dashboard`
- [ ] Preference prompt shows if preferences not submitted
- [ ] Preference form at `/student/preferences` submits and saves to Supabase
- [ ] Admin logs in and sees student table with preference badges
- [ ] RA logs in and sees their dashboard
- [ ] Wrong role is blocked by `ProtectedRoute`
- [ ] Supabase dashboard confirms data is being written to the correct tables
MDEOF
echo "Document created successfully"
wc -l /home/claude/auth_guide.md
Output

Document created successfully
2016 /home/claude/auth_guide.md
Done
