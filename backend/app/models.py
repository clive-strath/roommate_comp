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
