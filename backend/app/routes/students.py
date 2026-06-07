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
