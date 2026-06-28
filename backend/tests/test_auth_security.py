import pytest

from app import create_app
from app.config import Config
from app.extensions import db, bcrypt
from app.models import Student, AdminUser, AuditLog, TokenBlocklist


@pytest.fixture
def app(monkeypatch, tmp_path):
    db_path = tmp_path / "auth_security.sqlite"

    monkeypatch.setattr(Config, "SQLALCHEMY_DATABASE_URI", f"sqlite:///{db_path}")
    monkeypatch.setattr(Config, "SQLALCHEMY_ENGINE_OPTIONS", {})
    monkeypatch.setattr(Config, "SECRET_KEY", "test-secret-key-with-32-plus-bytes")
    monkeypatch.setattr(Config, "JWT_SECRET_KEY", "test-jwt-secret-key-with-32-plus-bytes")

    app = create_app()
    app.config.update(
        TESTING=True,
        RATELIMIT_ENABLED=False,
        WTF_CSRF_ENABLED=False,
    )

    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


def test_register_rejects_weak_password(client):
    payload = {
        "name": "Test Student",
        "email": "weakpass@test.edu",
        "password": "weakpass1",
        "student_number": "S1001",
        "year": 2,
        "gender": "male",
    }

    response = client.post("/api/auth/register", json=payload)

    assert response.status_code == 400
    body = response.get_json()
    assert "Password must be at least 12 characters" in body["error"]


def test_register_accepts_strong_password(client):
    payload = {
        "name": "Strong Student",
        "email": "strongpass@test.edu",
        "password": "StrongPass!123",
        "student_number": "S1002",
        "year": 3,
        "gender": "female",
    }

    response = client.post("/api/auth/register", json=payload)

    assert response.status_code == 201
    body = response.get_json()
    assert body["message"] == "Registration successful. Please log in."


def test_failed_login_creates_audit_log(app, client):
    with app.app_context():
        hashed_pw = bcrypt.generate_password_hash("StrongPass!123").decode("utf-8")
        student = Student(
            name="Student One",
            email="student1@test.edu",
            password=hashed_pw,
            student_number="S1003",
            year=1,
            gender="male",
            status="active",
        )
        db.session.add(student)
        db.session.commit()

    response = client.post(
        "/api/auth/login",
        json={"email": "student1@test.edu", "password": "WrongPass!123"},
    )

    assert response.status_code == 401

    with app.app_context():
        log = AuditLog.query.filter_by(action="auth.login_failed").first()
        assert log is not None
        assert log.actor_type == "system"


def test_logout_adds_blocklist_and_audit_log(app, client):
    with app.app_context():
        hashed_pw = bcrypt.generate_password_hash("StrongPass!123").decode("utf-8")
        admin = AdminUser(
            name="Admin One",
            email="admin1@test.edu",
            password=hashed_pw,
            role="admin",
            status="active",
        )
        db.session.add(admin)
        db.session.commit()

    login = client.post(
        "/api/auth/login",
        json={"email": "admin1@test.edu", "password": "StrongPass!123"},
    )
    assert login.status_code == 200
    token = login.get_json()["token"]

    logout = client.post(
        "/api/auth/logout",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert logout.status_code == 200

    with app.app_context():
        assert TokenBlocklist.query.count() == 1
        log = AuditLog.query.filter_by(action="auth.logout").first()
        assert log is not None
        assert log.actor_type == "admin"
