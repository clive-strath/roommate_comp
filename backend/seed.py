from app import create_app
from app.extensions import db, bcrypt
from app.models import AdminUser

app = create_app()
with app.app_context():
    # Clear existing if any
    AdminUser.query.delete()
    
    # Create Admin
    admin_pw = bcrypt.generate_password_hash("adminpassword").decode("utf-8")
    admin = AdminUser(
        name="System Admin",
        email="admin@university.ac.ke",
        password=admin_pw,
        role="admin",
        status="active"
    )
    db.session.add(admin)
    db.session.commit() # commit first so we get admin_id
    
    # Create Resident Advisor
    ra_pw = bcrypt.generate_password_hash("rapassword").decode("utf-8")
    ra = AdminUser(
        name="Advisor John",
        email="ra@university.ac.ke",
        password=ra_pw,
        role="resident_advisor",
        hostel_block="A",
        status="active",
        created_by=admin.admin_id
    )
    db.session.add(ra)
    db.session.commit()
    
    print("Seed completed successfully!")
