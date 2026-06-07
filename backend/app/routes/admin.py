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
