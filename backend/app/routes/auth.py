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

    # Email format validation (disable DNS check for development)
    try:
        validate_email(data["email"], check_deliverability=False)
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
